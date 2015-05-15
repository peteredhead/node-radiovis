var util = require('util'),
	fs = require('fs');

function Sender(msgFile, topic) {
	var self = this;
	this.running = true;
	this.senderInterval;
	this.msgFile = msgFile;
	this.topic = topic;
	this.position = 0;
}

Sender.prototype.reload = function() {
	if (!this.running) {
		return;
	}
	var msgFile = this.msgFile;
	this.stop();
	var self = this;
	util.log("Reloading "+this.msgFile);
	fs.readFile(msgFile, function(err, data) {
		if (err) {
			util.error(err);
		}
		fs.watchFile(msgFile, function (curr, prev) {
			  self.reload();
		});
		var messages = String(data); 
		var msgList = messages.split("\n");
		var msgCount = msgList.length;
		
		self.msgList = msgList;
		self.msgCount = msgCount;
		self.senderInterval = setInterval(sendMsg, 8000);
		util.log('Starting sender');
		self.send();
		function sendMsg() {
			self.send();
		}
	});
};

Sender.prototype.send = function() {
	if ((this.msgList[this.position].indexOf('TEXT') == 0) || (this.msgList[this.position].indexOf('SHOW') == 0)) {
		var timestamp = new Date().getTime();
		var random = Math.floor(Math.random()*200);
		var msgId = timestamp+':'+random;
		cometQueueHandler.process_queue(this.topic, msgId, this.msgList[this.position]);
		stompQueueHandler.process_queue(this.topic, msgId, this.msgList[this.position]);
	}
	this.position++;
	if (this.position == this.msgCount) { this.position = 0;}
	return
};

Sender.prototype.stop = function() {
	util.log("Stopping sender");
	clearInterval(this.senderInterval);
	fs.unwatchFile(this.msgFile);
	return
};

Sender.prototype.setRunning = function(state) {
	var self = this;
	if (state == 'stop') {
		self.running = false;
		self.stop();
	}
	if (state == 'start') {
		self.running = true;
		self.reload();
	}
	return self.running;
};

Sender.prototype.changeTopic = function (topic) {
	this.topic = topic;
	return
};

exports.Sender = Sender;