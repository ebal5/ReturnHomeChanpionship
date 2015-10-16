@(myName: String)(implicit request: RequestHeader)

function Logger(lv){
    this.showLevel = lv;
}
Logger.prototype.logging = function(mes){
    console.log(mes);
};
Logger.prototype.log = function (str, level){
    level = level || 0;
    if(level >= this.showLevel){
        var lvMes = "";
        switch (level){
        case 0:
            lvMes = "[Develop] -- ";
            break;
        case 1:
            lvMes = "[Notice] -- ";
            break;
        case 2:
            lvMes = "[Warning] -- ";
            break;
        case 3:
            lvMes = "[Error] -- ";
            break;
        case 4:
            lvMes = "[Fatal] -- ";
            break;
        default:
            lvMes = "[LogError] -- ";
        }
        this.logging(lvMes+str);
    }
};
var logger = new Logger(0);

var wslog = [];
var sendLog = [];
var points = [];

function Application(tgtID, wsURL){
    var self = this;
    this.oppName = "";
    this.myName = "@myName";

    this.wave = 0;
    this.pos = -1;
    this.myMap = [0,0,0,0,0,0,0,0,0,0];
    this.doMap = [0,0,0,0,0,0,0,0,0,0];
    this.rsMap = [0,0,0,0,0,0,0,0,0,0];
    this.tmpMap = [0,0,0,0,0,0,0,0,0,0];
    this.gameDone = false;
    this.editFlag = false;
    this.getDone = false;
    this.doFlag = false;
    this.tool = 0;
    var tgt = tgtID || "target";
    this.canvas = document.getElementById(tgt);
    if(typeof(this.canvas.getContext) == "undefined"){
        logger.log("[Canvas] -- Cannot get Context.", 4);
    }
    this.ctx = this.canvas.getContext('2d');
    logger.log("[Application] -- It's canvas id: "+ (tgtID||"target"), 1);
    this.canvas.addEventListener('click', this.click(), false);

    this.ws = {
        socket: undefined,
        send: function (tp, data){
            var obj = {"id": this.idGen(),"type": tp,"data": data};
	    sendLog.push(obj);
            var json = JSON.stringify(obj);
            logger.log("[WebSocket] -- Send a message. message: "+json, 0);            
            this.socket.send(json);
        },        
        init: function (){
            var url = 'ws://fes.eval.click:443/gamews' || wsURL || "@routes.Application.gameWS().webSocketURL()";
            // var url = wsURL || "@routes.Application.gameWS().webSocketURL()";
            logger.log("URL is :"+url, 1);
            this.socket = new WebSocket(url);
            this.socket.onopen = function (){
                logger.log("[WebSocket] -- Open new connection with url: "+url, 1);
            };
            this.socket.onclose = function (){
                self.ws.send("Bye", "Good bye!");
            };
            this.socket.onmessage = function (ev){
                var obj = JSON.parse(ev.data);
		wslog.push(obj);
                logger.log("[WebSocket] -- Get a message. message: "+obj.toString(), 0);
                switch (obj.type){
                case "MineMap":
                    logger.log("[WebSocket] -- MineMap message");
                    self.setDoMap(obj.data.map);
                    break;
                case "Restart":
                    logger.log("[WebSocket] -- Restart message");
                    self.waiting();
                    break;
                case "Ranking":
                    logger.log("[WebSocket] -- new ranking");
                    self.ranking(obj.data);
                    break;
                case "Start":
                    logger.log("[WebSocket] -- Start message");
                    self.oppName = obj.data.opp;
                    self.room = obj.data.rid;
                    self.game();
                    break;
                case "Result":
                    logger.log("[WebSocket] -- Result message");
                    break;
                case "FinalResult":
                    logger.log("[WebSocket] -- FinalResult message");
                    self.getFRes(obj.data);
                    break;
                case "Complete":
                    logger.log("[WebSocket] -- Copmplete message");
                    break;
                case "Ping":
                    logger.log("[WebSocket] -- receive ping message");
                    self.ws.send("Pong", "I'm living");
                    break;
                case "Wait":
                    logger.log("[WebSocket] -- Wait message from server");
                    break;
                case "Error":
                    logger.log("[WebSocket -- Error message: "+obj.data,3);
                    self.drawError();
                    break;
                default:
                    logger.log("[WebSocket] -- undefined type. type: "+obj.type, 3);
                }
            };
        },
        idGen: (function (){var id=-1; return function(){id+=2; return id;};})()
    };
    this.ws.init();
}

Application.prototype.drawBack = function (){
    var ctx = this.ctx;
    ctx.clearRect(0,0,this.canvas.width, this.canvas.height);
    ctx.fillStyle = '#ffefb6'; // Background color
    ctx.fillRect(0,0,this.canvas.width, this.canvas.height);
};
Application.prototype.drawWave = function (){
    this.drawBack();
    var ctx = this.ctx;
    ctx.font = 'bold 20px serif';
    ctx.fillStyle = '#000';
    ctx.fillText('Wave '+this.wave, 200, 100);
    ctx.fillText('あいて： '+this.oppName+' さん', 200, 50);
};
Application.prototype.drawDecos = function (){
    var ctx = this.ctx;
    var old = ctx.lineWidth;

    // draw School
    ctx.fillStyle = '#888';
    ctx.strokeStyle = '#888';
    ctx.fillRect(90, 245, 25, 25);
    ctx.fillRect(65, 270, 75,50);
    ctx.beginPath();
    ctx.arc(102.5, 257.5, 10, 0, 2*Math.PI, true);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.fill();

    // draw House
    ctx.strokeStyle = '#E6B85C';
    ctx.beginPath();
    ctx.lineWidth = 15;
    ctx.moveTo(615, 260);
    ctx.lineTo(615, 240);
    ctx.closePath();
    ctx.stroke();    

    ctx.lineWidth = 10;
    ctx.strokeStyle = '#f00';    
    ctx.beginPath();
    ctx.moveTo(570, 263);
    ctx.lineTo(600, 245);
    ctx.lineTo(630, 263);
    ctx.closePath();
    ctx.stroke();

    ctx.strokeStyle = '#000';
    ctx.fillStyle = '#E6B85C';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(625, 260);
    ctx.lineTo(625, 310);
    ctx.lineTo(575, 310);
    ctx.lineTo(575, 260);
    ctx.lineTo(600, 245);
    ctx.lineTo(625, 260);
    ctx.closePath();
    ctx.fill();

    ctx.lineWidth = old;
};
Application.prototype.drawError = function (){
    this.drawBack();
    var result = confirm("コネクションが切断されました。もう一度プレイしますか？");
    if(result){
        this.reset();
    }else{
        location.href = "/";
    }
};

Application.prototype.drawMyMap = function (){
    this.drawWave();
    this.drawDecos();
    var ctx = this.ctx;
    ctx.fillStyle = '#000';
    ctx.strokeStyle = '#000';
    var bombs = 0;
    for(var i=0; i<10; i++){
        if(this.myMap[i] == 0){
            ctx.strokeRect(100+50*i, 150, 50, 50);
        }else{
            bombs++;
            ctx.strokeRect(100+50*i, 150, 50, 50);
            ctx.fillRect(100+50*i, 150, 50, 50);
        }
    }
    var remain = this.wave-bombs;
    ctx.font = 'bold 20px serif';
    ctx.lineWidth = 2;
    ctx.fillStyle = '#000';
    ctx.fillText('地雷 あと '+remain+'個', 500, 100);

    ctx.fillStyle = '#faa';
    ctx.fillRect(300, 450, 100, 50);
    ctx.fillStyle = '#000';
    ctx.fillText('埋める', 310, 480);
};
Application.prototype.drawDoMap = function (){
    this.drawWave();
    this.drawDecos();
    var ctx = this.ctx;
    ctx.strokeStyle = '#000';
    var bombs = 0;
    for(var i=0; i<10; i++){
            ctx.strokeRect(100+50*i, 150, 50, 50);
    }

    ctx.font = 'bold 20px serif';

    ctx.fillStyle = '#000';
    ctx.fillText('解除ツール あと '+this.tool+'個', 400, 100);
    
    ctx.fillStyle = '#faa';
    ctx.fillRect(100, 450, 100, 50);
    ctx.fillStyle = '#000';
    ctx.fillText('進む',110, 480);

    ctx.fillStyle = '#faa';
    ctx.fillRect(300, 450, 100, 50);
    ctx.fillStyle = '#000';
    ctx.fillText('解除',310, 480);

    ctx.fillStyle = '#faa';
    ctx.fillRect(500, 450, 100, 50);
    ctx.fillStyle = '#000';
    ctx.fillText('戻る', 510, 480);

    for(var j = 0; j <= this.pos; j++){
        switch (this.rsMap[j]){
        case 0:
            ctx.fillStyle = '#00d';
            ctx.fillRect(100+50*j, 150, 50, 50);
            break;
        case 1:
            ctx.fillStyle = '#f00';
            ctx.fillRect(100+50*j, 150, 50, 50);
            break;
        case 2:
        case 3:
            ctx.fillStyle = '#0f0';
            ctx.fillRect(100+50*j, 150, 50, 50);
            break;
        }
    }
};

Application.prototype.clearWave = function (){
    logger.log("Clear wave",1);
    var self = this;
    var ctx = self.ctx;
    ctx.clearRect(0,0,this.canvas.width, this.canvas.height);
    ctx.fillStyle = '#0e9';
    ctx.font = 'bold 50px serif';
    ctx.fillText("Clear wave "+self.wave, 300, 250);
    this.doFlag=false;
    var fn = function (){self.sendRes();};
    window.setTimeout(fn, 2000);
};

Application.prototype.bomb = function (){
    logger.log('Bomb', 1);
    var ctx = this.ctx;
    ctx.clearRect(0,0,this.canvas.width, this.canvas.height);
    ctx.fillStyle = '#f00';
    ctx.beginPath();
    ctx.arc(400,300,200,0, Math.PI*2, true);
    ctx.fill();
    var self = this;
    self.doFlag=false;
    var fn = function (){self.sendRes();};
    window.setTimeout(fn, 2000);
};

Application.prototype.rtb = function (){
    logger.log("Return to Base",1);
    this.rsMap[this.pos] = 4;
    var ctx = this.ctx;
    this.drawBack();
    ctx.fillStyle='#000';
    ctx.font = 'bold 40px serif';
    ctx.fillText('諦めて勉強しな', 100, 200);
    var self = this;
    var fn = function(){self.doFlag=false; self.sendRes();};
    window.setTimeout(fn, 2000);
};

Application.prototype.checkMyMap = function (){
    return true;
};

Application.prototype.edit = function (){
    var self = this;
    var fn = function (){self.editFlag = true;self.drawMyMap();};
    var ctx = self.ctx;
    self.editFlag = true;
    self.wave++;
    self.myMap = [0,0,0,0,0,0,0,0,0,0];    
    self.drawBack();
    ctx.fillStyle = '#000';
    ctx.font = 'bold 50px serif';
    ctx.fillText("Wave "+self.wave+" Map Edit Part", 100, 300);
    window.setTimeout(fn, 2000);
};

Application.prototype.getPoint = function (){
    var point = 0;
    if(this.pos >= 0){
        for(var i = 0; i < this.rsMap.length; i++){
            if(this.rsMap[i] == 4){
                break;
            }else if(this.rsMap[i] == 1)
            {
                point = 0;break;
            }else {
                point++;
            }
        }
    }
    return point;
};

Application.prototype.getFRes = function (data){
    this.drawBack();
    this.editFlag = false;
    this.doFlag = false;
    this.gameDone = true;
    var ctx = this.ctx;
    ctx.font = 'bold 60px serif';
    if(data.my > data.opp){
        ctx.fillStyle = '#d22';
        ctx.fillText('あなた: '+data.my, 200, 100);
        ctx.fillText(this.oppName+" さん: "+data.opp, 200, 200);
        ctx.fillText('You win!', 200, 300);
    }else if(data.my == data.opp){
        ctx.fillStyle = '#888';
        ctx.fillText('あなた: '+data.my, 200, 100);
        ctx.fillText(this.oppName+" さん: "+data.opp, 200, 200);
        ctx.fillText('Draw!', 250, 300);        
    }else {
        ctx.fillStyle = '#22d';
        ctx.fillText('あなた: '+data.my, 200, 100);
        ctx.fillText(this.oppName+" さん: "+data.opp, 200, 200);
        ctx.fillText('You lose!', 200, 300);
    }
    ctx.fillStyle = '#000';
    ctx.font = 'bold 40px serif';
    ctx.strokeRect(300, 400, 180, 50);
    ctx.fillText('もう一度', 300, 440);
};

Application.prototype.do = function (){
    // 開始メッセージでも表示する？
    // 現在の状態がその一例。 正直アニメーションはめんどかった。
    this.doMap = this.tmpMap;
    this.getDone = false;
    var ctx = this.ctx;
    this.rsMap = [0,0,0,0,0,0,0,0,0,0];
    this.tool = this.wave;
    this.drawBack();
    ctx.fillStyle = '#000';
    ctx.font = 'bold 50px serif';
    ctx.fillText('Wave '+this.wave+" Start!!", 250, 300);
    var self = this;
    var func = function (){self.pos = -1; self.doFlag = true; self.drawDoMap(); };
    window.setTimeout(func, 2000);
};

Application.prototype.game = function (){
    if(typeof(this.pre) != "undefined"){this.pre();}
    this.edit();
};

Application.prototype.reset = function (){
    this.waveDone = false;
    this.editFlag = false;
    this.getDone = false;
    this.doFlag = false;
    this.gameDone = false;
    this.wave = 0;
    this.tool = 0;
    this.pos = -1;
    this.myMap = [0,0,0,0,0,0,0,0,0,0];
    this.doMap = [0,0,0,0,0,0,0,0,0,0];
    this.rsMap = [0,0,0,0,0,0,0,0,0,0];    
    this.oppName = "";
    this.room = "";
    logger.log("[Application] -- Reset game.", 2);
    this.ws.send("Restart", null);
    this.waiting();
};

Application.prototype.ranking = function (data){
    var tgt = document.getElementById('ranking');
    tgt.innerHTML = "";
    for (var i = 0; i < data.length; i++){
        var elm = document.createElement('li');
        elm.innerHTML = data[i].name + " さん : "+data[i].point+" ポイント";
        tgt.appendChild(elm);
    }
};

Application.prototype.waiting = function (){
    this.drawBack();
    var ctx = this.ctx;
    ctx.font = 'bold 20px serif';
    ctx.lineWidth = 2;
    ctx.fillStyle = '#000';
    ctx.fillText("通信待機中", 300, 200);
    logger.log("[Application] -- Waiting for message from server", 1);
};

Application.prototype.toggleBomb = function (b){
    var remain = this.wave - this.myMap.reduce(function (n,acc){return n+acc;});
    if(this.myMap[b] == 0 && remain > 0){
        this.myMap[b] = 1;
    }else{
        this.myMap[b] = 0;
    }
    this.drawMyMap();
};

Application.prototype.setDoMap = function (map){
    this.tmpMap = map;
    this.getDone = true;
    if(!this.editFlag && !this.doFlag){
        this.doMap = this.tmpMap;
        this.do();
    }
    logger.log("[Application] -- Set enemy map.",1);
};

Application.prototype.sendMap = function (){
    this.editFlag = false;
    var data = {
        "wave": this.wave,
        "map": this.myMap
    };
    this.ws.send("MineMap", data);
};

Application.prototype.sendRes = function (){
    this.doFlag = false;
    var pt = this.getPoint();
    var obj = {
        wave: this.wave,
        map: this.rsMap,
        pt: pt
    };
    points.push(obj);
    this.ws.send("Result", obj);
    if(this.wave < 3){this.edit();}else{this.waiting();}
};

Application.prototype.send = function (tp, data){
    this.ws.send(tp, data);
};

Application.prototype.click = function (){
    var self = this;
    return function (ev){
        var rect = ev.target.getBoundingClientRect();
        var x = ev.clientX - rect.left;
        var y = ev.clientY - rect.top;
        logger.log("[Click] -- x: "+x+" y: "+y);
        if(self.editFlag){
            if(y >= 150 && y <= 200 && x >= 100 && x <= 600){
                var num = Math.floor((x - 100)/50);
                self.toggleBomb(num);
            }else if(y >= 450 && y <= 500 && x >= 300 && x <= 400 && self.checkMyMap()){
                self.sendMap();
                if(self.getDone){
                    self.do();
                }else{
                    self.waiting();
                }
            }
        }else if(self.doFlag){
            if(y >= 450 && y <= 500 && self.pos < 9){
                var func;
                if(x >= 100 && x <= 200){
                    // 通常の進行
                    self.pos++;
                    if(self.doMap[self.pos] == 1){
                        self.rsMap[self.pos] = 1;
                        self.bomb();
                    }else{
                        if(self.pos > 0){
                            self.rsMap[self.pos] = 0;
                        }
                        if(self.pos == 9){
                            self.clearWave();
                        }else{
                            self.drawDoMap();
                        }
                    }
                }else if(x >= 300 && x <= 400){
                    // 解除ツール use
		    if(self.tool > 0){
                        self.pos++;
                        self.tool--;
                        if(self.doMap[self.pos] == 1){
                            self.rsMap[self.pos] = 2;
                        }else{
                            self.rsMap[self.pos] = 3;
                        }
                        if(self.pos == 9){
                            self.clearWave();
                        }else{
                            self.drawDoMap();
                        }
                    }else{
                        alert("もうないよ");
                    }
                    self.drawDoMap();
                }else if(x >= 500 && x <= 600){
                    // 戻る気になったらしい。
                    // 諦めて勉強しな
                    self.rsMap[self.pos] += 4;
                    self.rtb();
                }
                logger.log("Current position: "+self.pos, 0);
                logger.log("Current map value: "+self.rsMap[self.pos], 0);
            }
        }else if(self.gameDone){
            if(x >= 300 && x <= 480 && y >= 400 && y <= 450){
                logger.log("will be reset");
                self.reset();
            }
        }
    };
};

var app;
document.addEventListener("DOMContentLoaded", function(){
    app = new Application();
    app.waiting();
});
