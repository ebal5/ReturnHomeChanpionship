package models

import akka.actor._
import akka.pattern.ask
import akka.util.Timeout
import play.api.libs.json._
import scala.concurrent.Await
import scala.concurrent.duration._
import scala.concurrent.ExecutionContext.Implicits.global
import scala.util.control.Exception._

import models.exceptions._

case class Start(opp: String, rid: String)
object Start {
  implicit val StartReads = Json.reads[Start]
  implicit val StartWrites = Json.writes[Start]
}
// my point and opponent point
case class FinalResult(my: Int, opp: Int)
object FinalResult {
  implicit val FinalResultReads = Json.reads[FinalResult]
  implicit val FinalResultWrites = Json.writes[FinalResult]
}

object User {
  def props(name: String)(out: ActorRef) = Props(classOf[User], name, out)
}

class User(name: String, out: ActorRef) extends Actor {

  implicit val timeout = Timeout(5 seconds)

  val id: Iterator[Int] = {
    def gen(s: Int): Stream[Int] = s #:: gen(s+2)
    gen(0).iterator
  }

  private var oppName: String = ""
  private var roomID: String = ""
  private var roomAct: ActorRef = null
  private var lastGreat = System.currentTimeMillis

  def receive = {
    case mes: JsValue =>
      val res = allCatch either {
        val id = (mes \ "id").validate[Int] match {
          case s: JsSuccess[Int] => s.get
          case e: JsError =>
            throw new JsUnintelligibleException("Cannot determine id")            
        }
        val tp = (mes \ "type").validate[String] match {
          case s: JsSuccess[String] => s.get
          case e: JsError =>
            throw new JsUnintelligibleException("Cannot determine type")
        }
        (mes \ "data") match {
          case d: JsDefined =>
            tp match {
              case "Restart" | "Start" =>
                mes_Start(id, d.get, sender)
              case "MineMap" =>
                mes_MineMap(id, d.get, sender)
              case "Result" =>
                mes_Result(id, d.get, sender)
              case "Pong" =>
                this.lastGreat = System.currentTimeMillis
              case s =>
                throw new JsOutOfRangeException("Not enable type("+s+")")
            }
          case u: JsUndefined =>
            throw new JsUndefinedException(u.error.toString)
        }
      }
      res match {
        case Right(json) =>
          out ! json
        case Left(e) =>
          val json = newMes("Error", Json.toJson(e.getMessage))
          println("[Error] some error occur. "+e.getClass.toString)
          out ! json
      }
    case mes: Start =>
      val json = newMes("Start", Json.toJson(mes))
      oppName = mes.opp
      roomID = mes.rid
      roomAct = sender
      out ! json
    case mes: FinalResult =>
      val json = newMes("FinalResult", Json.toJson(mes))
      out ! json
    case mes: MineMapMsg =>
      out ! newMes("MineMap", Json.toJson(mes))
    case mes: Bye =>
      out ! newMes("Error", JsString("Connection refused"))
    case mes: List[Rank] =>
      println("Ranking")
      out ! newMes("Ranking", Json.toJson(mes))
    case s =>
      println("[User] Unexpected message. "+s.toString)
  }

  override def preStart = {
    Entry.entry ! Add(this.name)
    out ! newMes("Wait", JsString("Wait prease"))
  }

  override def postStop = {
    Entry.entry ! Delete(this.name)
    if(roomAct != null){
      roomAct ! Bye("Connection refused")
    }
  }

  def newMes(tp: String, data: JsValue): JsValue = Json.obj(
    "id" -> id.next,
    "type" -> tp,
    "data" -> data
  )

  def mes_Start(id: Int, data: JsValue, room: ActorRef): JsValue = {
    val mes = Add(name)
    Entry.entry ! mes
    newMes("Complete", JsString("Start message sent"))
  }

  def mes_MineMap(id: Int, data: JsValue, room: ActorRef): JsValue = {
    val mineMap = data.validate[MineMapMsg] match {
      case s: JsSuccess[MineMapMsg] => s.get
      case e: JsError =>
        throw new JsUnintelligibleException("Cannot get mine map")
    }
    roomAct ! mineMap
    newMes("Complete", JsString("Got mine map"))
  }

  def mes_Result(id: Int, data: JsValue, room: ActorRef): JsValue = {
    val result = data.validate[ResultMsg] match {
      case s: JsSuccess[ResultMsg] => s.get
      case e: JsError =>
        throw new JsUnintelligibleException("Cannot get Result")
    }
    roomAct ! result
    newMes("Complete", JsString("Got result"))
  }
}
