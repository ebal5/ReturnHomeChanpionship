package models

import akka.actor._
import akka.pattern.ask
import akka.util.Timeout
import java.io._
import java.util.UUID
import play.api.libs.json._
import scala.collection.mutable
import scala.concurrent.Await
import scala.concurrent.duration._
import scala.concurrent.ExecutionContext.Implicits.global
import scala.io.Source

case class Add(name: String)
case class Delete(name: String)

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
    case Delete(name) =>
      if (!users.isEmpty){
        val u1 = users.dequeue
        if (!(u1.name == name)){
          users.enqueue(u1)
        }else{
          println("dequeue user")
        }
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
case class Bye(mes: String) extends Msg

case class Rank(name: String, point: Int)
object Rank {
  implicit val RankReads = Json.reads[Rank]
  implicit val RankWrites = Json.writes[Rank]
}

class GameRoom(rid: String, u1: UserWrapper, u2: UserWrapper) extends Actor {
  private val waves = 3
  val rankingFile = "/var/games/festival/ranking.dat"

  def getRanking():Option[List[Rank]] = {
    val file = new File(rankingFile)
    if (file.createNewFile){
      None
    }else{
      val scr = Source.fromFile(rankingFile)
      val str = scr.getLines.reduceOption((z,n) => z+"\n"+n)
      val json = str match {
        case Some(s) => Json.parse(s)
        case None => Json.toJson("")
      }
      if (json == Json.toJson("")){
        None
      }else{
        json.validate[List[Rank]] match {
          case s: JsSuccess[List[Rank]] =>
            Some(s.get.sortBy(r => r.point).reverse.take(10))
          case e: JsError =>
            println(rankingFile+" is wrong file")
            None
        }
      }
    }
  }

  def setRanking(ls: List[Rank]){
    val file = new File(rankingFile)
    val oldOption = getRanking()
    oldOption match {
      case Some(s) =>
        val ranking = (s ++ ls).sortBy(r => r.point).reverse
        val json = Json.toJson(ranking)
        val out = new PrintWriter(file)
        println(json.toString)
        out.println(json)
        out.close
      case None =>
        val json = Json.toJson(ls)
        val out = new PrintWriter(file)
        println(json.toString)
        out.println(json)
        out.close
    }
  }

  def receive = {
    case mes: MineMapMsg =>
      val usr = get(sender)
      usr.maps += mes.map
      opp(sender).act ! mes
    case mes: ResultMsg =>
      val usr = get(sender)
      usr.results += mes.map
      usr.points += mes.pt
      val ranking = getRanking() match {
        case Some(r) =>
          u1.act ! r
          u2.act ! r
        case None =>
          println("Nothing for ranking")
      }
      val enemy = opp(sender)
      if(mes.wave == waves && enemy.done){
        usr.act ! FinalResult(usr.total, enemy.total)
        enemy.act ! FinalResult(enemy.total, usr.total)
        setRanking(List[Rank](Rank(usr.name, usr.total), Rank(enemy.name, enemy.total)))
      }else if(mes.wave == waves){
        usr.done = true
      }
    case mes: Bye =>
      opp(sender).act ! mes
      self ! PoisonPill
    case s =>
      println("[GameRoom] Unexpected message "+s.toString)
  }

  private def opp(tgt: ActorRef): UserWrapper = if(u1.act == tgt){ u2}else{ u1}
  private def get(tgt: ActorRef): UserWrapper = if(u1.act == tgt){ u1}else{ u2}

  override def preStart = {
    u1.act ! Start(u2.name, rid)
    u2.act ! Start(u1.name, rid)
    getRanking match {
        case Some(r) =>
          u1.act ! r
          u2.act ! r
        case None =>
          println("Nothing for ranking")
    }
  }
}
