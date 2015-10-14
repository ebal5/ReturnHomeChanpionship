package controllers

import play.api._
import play.api.data.Forms._
import play.api.data._
import play.api.i18n.Messages.Implicits._
import play.api.libs.json._
import play.api.mvc._
import play.api.Play.current
import scala.concurrent.Future

import models.User

class Application extends Controller {

  val enterForm = Form(
    mapping(
      "name" -> text
    )((name) => name)((name) => Some(name))
  )

  def index = Action {
    Ok(views.html.index(enterForm)).withNewSession
  }

  def enter = Action { implicit rs =>
    enterForm.bindFromRequest.get match {
      case "" => BadRequest("Nick name is missing")
      case name: String =>
        Redirect("/game").withSession(
          "name" -> name
        )
    }
  }

  def game = Action { implicit rs =>
    rs.session.get("name") match {
      case Some(name) =>
        Ok(views.html.game(name))
      case None =>
        BadRequest("Nick name is missing")
    }
  }

  def gameWS = WebSocket.tryAcceptWithActor[JsValue, JsValue]{implicit rs =>
    Future.successful(rs.session.get("name") match {
      case None => Left(Forbidden)
      case Some(name) => Right(User.props(name))
    })
  }

  def gameJS = Action {implicit rs =>
    rs.session.get("name") match {
      case None => BadRequest("Nick name is missing")
      case Some(name) => Ok(views.js.application(name))
    }
  }
}
