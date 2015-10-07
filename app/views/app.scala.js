@(implicit request: RequestHeader)

function Logger(lv){
    this.showLevel = lv;
}
Logger.prototype.log = function (str, level){
    level = level || 0;
    if(level > this.showLevel){
        var lvMes = "";
        switch (level){
        case 0: case 1:
            lvMes = "[Normal] -- ";
            break;
        case 2:
            lvMes = "[Warning] -- ";
            break;
        case 3:
            lvMes = "[Error] -- ";
            break;
        case 4:
            // Check the spell
            lvMes = "[Fatle] -- ";
            break;
        default:
            lvMes = "[LogError] -- ";
        }
        this.logging(lvMes + str);
    }
};
Logger.prototype.logging = function(mes){
    console.log(mes);
};
var logger = new Logger(0);

function Application(tgtID, wsURL){
    this.tgt = document.getElementByID(tgtID || "target");

    // * must define MyCanvas class
    // * it should have
    // * + mineMap(map:Array[Int])
    // * + 
   
    function GameWS(url){
        this.canvas = canvas;
        this.mesID = this.getGenID();
        this.ws = new WebSocket(url);
        logger.log("[WebSocket] -- Open new websocket. url: "+url);
        this.ws.onopen = this.onopen;
        this.ws.onmessage = this.onmessage;
    }
    GameWS.prototype.getGenID = function (st){
        var id = (st && st -2) || -1;
        return function (){id+=2; return id;};
    };
    GameWS.prototype.onmessage = function (ev){
        var obj = JSON.parse(ev.data);
        logger("[WebSocket] -- Get a message. "+obj.toString);
        switch (obj.type){
        case "MineMap":
            break;
        case "Restart":
            break;
        case "Start":
            break;
        case "Ready":
            break;
        case "FinalResult":
            break;
        default:
            logger.log("[WebSocket] -- undefined type. "+obj.type, 3);
        }
    };
    GameWS.prototype.onopen = function (){
        this.send("Ready", null);
    };
    GameWS.prototype.send = function (tp, data){
        if(tp == undefined || data == undefined){
            logger.log("[WebSocket] -- invalide type or data." +
                       " At least, one of them is undefined", 2);
            return ;
        }else{
            var obj = {
                "id": this.mesID(),
                "type": tp,
                "data": data
            };
            var json = JSON.stringify(obj);
            this.ws.ws.send(json);
            logger.log("[WebSocket] -- send a message ("+json+")");
        }
    };
    
    this.ws = new GameWS(
        wsURL || "@routes.Application.gameWS().WebSocketURL()");
}

Application.prototype.wsOpen = function (){
    this.ws.send();
};