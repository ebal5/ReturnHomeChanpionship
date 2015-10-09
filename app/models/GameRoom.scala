package models

import akka.actor._
import akka.pattern.ask
import akka.util.Timeout
import java.util.UUID
import play.api.libs.json._
import scala.collection.mutable
import scala.concurrent.Await
import scala.concurrent.duration._
import scala.concurrent.ExecutionContext.Implicits.global

case class Add(name: String)

case class UserWrapper(name: String, act: ActorRef){
  val maps = new mutable.ArrayBuffer[Array[Int]]()
  val results = new mutable.ArrayBuffer[Array[Int]]()
  val points = new mutable.ArrayBuffer[Int]()
  def total(): Int = points.foldLeft(0)((n, acc) => n+acc)
  var done = false
}

class Entry() extends Actor{

  implicit val timeout = Timeout(5 seconds)

  // queue of users.
  lazy val users = mutable.Queue[UserWrapper]()

  def receive = {
    case Add(name) =>
      if (users.isEmpty){
        println("enqueue user")
        users.enqueue(UserWrapper(name, sender))
      }else{
        println("new room")
        val u1 = users.dequeue
        val id = UUID.randomUUID.toString
        val room = context.actorOf(Props(classOf[GameRoom], id, u1, UserWrapper(name, sender)))
      }
    case other =>
      println(other.toString)
  }
}

object Entry {
  val system = ActorSystem("game") // default actor system
  val entry = system.actorOf(Props[Entry])
}

sealed trait Msg
case class MineMapMsg(wave: Int, map: Array[Int]) extends Msg
object MineMapMsg {
  implicit val MineMapMsgReads = Json.reads[MineMapMsg]
  implicit val MineMapMsgWrites = Json.writes[MineMapMsg]
}
case class ResultMsg(wave: Int, map: Array[Int], pt: Int) extends Msg
object ResultMsg {
  implicit val ResultMsgReads = Json.reads[ResultMsg]
  implicit val ResultMsgWrites = Json.writes[ResultMsg]
}

class GameRoom(rid: String, u1: UserWrapper, u2: UserWrapper) extends Actor {
  private val waves = 3

  def receive = {
    case mes: MineMapMsg =>
      println("test")
      val usr = get(sender)
      usr.maps += mes.map
      println(usr.name)
      opp(sender).act ! mes
    case mes: ResultMsg =>
      val usr = get(sender)
      usr.results += mes.map
      usr.points += mes.pt
      val enemy = opp(sender)
      if(mes.wave == waves && enemy.done){
        usr.act ! FinalResult(usr.total, enemy.total)
        enemy.act ! FinalResult(enemy.total, usr.total)
      }else if(mes.wave == waves){
        usr.done = true
      }
    case s =>
      println("[GameRoom] Unexpected message"+s.toString)
  }

  private def opp(tgt: ActorRef): UserWrapper = if(u1.act == tgt){ u2}else{ u1}
  private def get(tgt: ActorRef): UserWrapper = if(u1.act == tgt){ u1}else{ u2}

  override def preStart = {
    u1.act ! Start(u2.name, rid)
    u2.act ! Start(u1.name, rid)
  }
}
