/**
 * node-radiovis
 * 
 * A demonstration of a self-contained RadioVIS system,
 * implemented in node.js
 * 
 * Copyright 2010 Global Radio 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. 
 * You may obtain a copy of the License at 
 * 
 * http://www.apache.org/licenses/LICENSE-2.0 
 * 
 * Unless required by applicable law or agreed to in writing, software 
 * distributed under the License is distributed on an "AS IS" BASIS, 
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. 
 * See the License for the specific language governing permissions and 
 * limitations under the License. 
*/

var sys = require('sys'),
	net = require('net'),
	http = require("http"),
	url = require("url"),
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
	sys.puts("Reloading "+this.msgFile);
	fs.readFile(msgFile, function(err, data) {
		if (err) {
			sys.puts(err);
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
	sys.puts("Stopping sender");
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

var cometPath = "/comet",
	adminPath = "/admin",
	slidesPath = "/slides",
	demoPath = "/demo",
	jsPath = "/js";

cometQueueHandler = new CometQueueHandler();
cometMessageCache = new CometMessageCache();
stompQueueHandler = new StompQueueHandler();
stompMessageCache = new StompMessageCache();

textFile = 'text.txt';
imageFile = 'slides.txt';
topicFile = 'topic.txt';

try {
baseTopic = fs.readFileSync(topicFile, 'utf8');
} catch (err) {
	sys.puts(err);
	sys.puts("Unable to load "+topicFile);
	sys.puts("Setting topic to /topic/fm/ce1/cc86/09630");
	baseTopic = "/topic/fm/ce1/cc86/09630";
}

// Start the sender
var textSender = new Sender(textFile,baseTopic+'/text');
textSender.reload();
var imgSender = new Sender(imageFile,baseTopic+'/image');
imgSender.reload();

try {
	http.createServer(function(request, response) {
		var path = url.parse(request.url, true).pathname;
		if (path.indexOf(cometPath) == 0) {
			// Process request
			try {
				var topics = url.parse(request.url, true).query['topic'];
			}
			catch (err) {
				send_error(500, "Error: " +err);
				return;
			}
			if (!topics) {
				send_error(500, "Invalid topic specified");
				return;
			}
    
			var last_id = url.parse(request.url, true).query['last_id'];
			if (last_id !== undefined) {
				if (topics.indexOf(',')>0) {
					var last_id_in_cache = cometMessageCache.get_latest_id(topics);
					if (!last_id_in_cache) {
						cometQueueHandler.add_client(response, topics);
					} else {
						if (last_id == last_id_in_cache) {
							cometQueueHandler.add_client(response, topics);
						} else {
							var msg = cometMessageCache.get_from_cache(topics);
							send_comet_message(response, msg['id'], msg['body']);
						}
					}
				} else {
					// Multiple topics
					var topicList = topics.toString().split(',');
					var most_recent_topic = '',
					most_recent_id = 0,
					most_recent_time = 0;
    		
					for (var i = 0; i < topicList.length; i++) {
						if (cometMessageCache.is_topic_in_cache(topicList[i])) {
							var topic_latest_time = cometMessageCache.get_latest_time(topicList[i]);
							if (most_recent_time < topic_latest_time) {
								most_recent_time = topic_latest_time;
								most_recent_topic = topicList[i];
								most_recent_id = cometMessageCache.get_latest_id(topicList[i]);
							}
						}
					}
					if (last_id == most_recent_id || most_recent_topic == '') {
						cometQueueHandler.process_request(response, topicList);
					} else {
						var msg = cometMessageCache.get_from_cache(most_recent_topic);
						send_comet_message(response, msg["id"], msg["body"]);
					}
				}
			} else {
				var topic = topics;
				var splitPos = topics.indexOf(',');
				if (splitPos > 0) {
					topic = topics.substring(0,splitPos);
				}    	
				if (cometMessageCache.is_topic_in_cache(topic)) {
					var msg = cometMessageCache.get_from_cache(topic);
					send_comet_message(response, msg["id"], msg["body"]);
				} else {
					cometQueueHandler.process_request(response, topics);
				}
			}
    
		} else if (path.indexOf(slidesPath) == 0 || path.indexOf(demoPath) == 0 || path.indexOf(jsPath) == 0) {
			serve_file(path, request, response);
		} else if (path.indexOf(adminPath) == 0) {
			if (request.client.remoteAddress != "127.0.0.1") {
				send_error(response, 403, 'Administration is restricted to local access only');
			}
			if (path.indexOf('/admin/loadMessages/')==0) {
				var msgFile;
				var msgLiId;
				var msgClass;
				try {
					if (path.indexOf('text')>0) {
						msgFile = textFile;
						msgLiId = 'textItem';
						msgClass = 'tmessage';
					} else if (path.indexOf('image')>0) {
						msgFile = imageFile;
						msgLiId = 'imageItem';
						msgClass = 'imessage';
					} else {
						send_error(response, 403, 'File not found');
					}
				} catch(err) {
					send_error(response, 500, 'Server Error');
				}
				
				fs.readFile(msgFile, function(err, data) {
					if (err) {
						sys.puts(err);
					}
					data = String(data);
					data_array = data.split("\n");
					var returns='';
					for (i=0;i<data_array.length;i++) {
						if (data_array[i].length>1) {
							returns = returns + '<li id="'+msgLiId+'-'+(i+1)+'"><div class="'+msgClass+'">'+data_array[i].substring(5)+'</div></li>'+"\n";
						}
					}
					response.writeHead(200);  
		      		response.write(returns);  
		      		response.end();
				});
				return
			}
			if (path.indexOf('/admin/getTopic') == 0) {
				response.writeHead(200);
				response.write(baseTopic);
				response.end();
				return
			}
			if (path.indexOf('/admin/setTopic') == 0) {
				var newTopic = path.substr(15);
				if (newTopic.indexOf('/topic')!=0) {
					send_error(response, 500, 'Invalid topic');
					return
				}
				sys.puts('Changing topic to '+newTopic);
			
			
				fs.writeFile(topicFile, newTopic, function(err) {
				    if(err) {
				        sys.puts(err);
				    } 
				}); 		
				textSender.changeTopic(newTopic+'/text');
				imgSender.changeTopic(newTopic+'/image');
				response.writeHead(200);
				response.write(newTopic);
				response.end();
				
				cometQueueHandler.process_queue(baseTopic+'/text', 0, 'DISCONNECT');
				cometQueueHandler.process_queue(baseTopic+'/image', 0, 'DISCONNECT');
				baseTopic = newTopic;
				return
			}
			
			if (path.indexOf("/admin/sender/") == 0) {
				status = path.substring(14);
				textSender.setRunning(status);
				var runningStatus = imgSender.setRunning(status);
				
				response.writeHead(200);
				if (runningStatus) {
					response.write('running');
				} else {
					response.write('stopped');
				}
				response.end();
				return;
			}
			
			if (path.indexOf("/admin/updateMessages")==0) {
				try {
					var type = url.parse(request.url, true).query['type'];
					var msg0 = url.parse(request.url, true).query['msg_0'] || '';
					var msg1 = url.parse(request.url, true).query['msg_1'] || '';
					var msg2 = url.parse(request.url, true).query['msg_2'] || '';
					var msg3 = url.parse(request.url, true).query['msg_3'] || '';
					var prefix;
					if (type == 'text') {
						filename = textFile;
						prefix = 'TEXT ';
					} else if (type == 'image') {
						filename = imageFile;
						prefix = 'SHOW ';
					} else {
						send_error(reponse, 500, 'Invalid type');
						return
					}
					response.end();
					var fileData=prefix+msg0+"\n"+prefix+msg1+"\n"+prefix+msg2+"\n"+prefix+msg3+"\n";
					fs.writeFile(filename, fileData, function(err) {
					    if(err) {
					        sys.puts(err);
					    } 
					}); 					
					return
				}
				catch (err) {
					sys.puts(err);
					send_error(response, 500, "Error: " +err);
					return;
				}	
			}	
			serve_file(path, request, response);
			
		} else {
			response.writeHead(404);
			response.write("Requested URL not found");
			response.end();
		}
	}).listen(80);
} catch (err) {
	if (err == "Error: EADDRINUSE, Address already in use") {
		sys.puts(err);
		process.exit(code=0);
	} else {
		sys.puts(err);
	}
}	

var stompServer = net.createServer(function (stream) {
	var buffer = '';
	var connected = false;
	var self = this;
	stream.setEncoding('utf8');
	stream.on('connect', function () {
	});
	
	stream.on('data', function (data) {
		function extractDestination(cmd) {
			topic = null;
			for (line in cmd) {
				if ((topic == null) && (cmd[line].indexOf('destination:')==0)) {
					topic = cmd[line].substring(12).replace(/\r/g,'');
				}
			}
			return topic;
		}
		
		function checkValidTopic(topic) {
			if (topic.indexOf('/topic/')!=0) {
				return false;
			} else {
				return true;
			}
		}

		buffer = buffer + data;
		if (data.indexOf(String.fromCharCode(0))>=0) {

			// Take the first line as the command - ie CONNECT, SUBSCRIBE, UNSUBSCRIBE, DISCONNECT
			var buffer_array = buffer.split("\n");
		
			switch (buffer_array[0].replace(/\r/g,'')) {
				case 'CONNECT':
					connected = true;
					stream.write("CONNECTED\n");
					stream.write("session: 6861707079636174\r\n\r\n\0");
					break;
				case 'SUBSCRIBE':
					if (!connected) {
						stream.write("ERROR - Not connected\r\n\0");
						break;
					}
					topic = extractDestination(buffer_array);
					if (!topic) {
						stream.write("ERROR - No destination specified\r\n\0");
						break;
					}
					if (!checkValidTopic(topic)) {
						stream.write("ERROR - Invalid topic name\r\n\0");
						break;
					}
					stompQueueHandler.add_client(stream, topic);
					break;
				case 'UNSUBSCRIBE':
					if (!connected) {
						stream.write("ERROR - Not connected\r\n\0");
						break;
					}
					stompQueueHandler.remove_client(stream, topic);
					break;
				case 'DISCONNECT':
					stream.end();
					break;
				default:
					stream.write('ERROR - Unrecognised command '+buffer_array[0]+"\n\0");
			}
			// Had a command, clear the command buffer
			buffer = '';
		}
	});
	stream.on('end', function () {
		stream.end();
	});
});
stompServer.listen(61613);

stompServer.addListener("error", function() {
	
});

function CometQueueHandler() {
	queue = new Array();
}

CometQueueHandler.prototype.process_request = function (callback, topics) {
	if (topics.constructor == Array) {
		for (var i = 0; i < topics.length; i++) {
			this.add_client(callback, topics[i]);
		}
	} else {
		this.add_client(callback, topics);
	}
	return
};

CometQueueHandler.prototype.add_client = function (callback, topic) {
	if (queue[topic] === undefined) {
		var callbacks = new Array(callback);
		queue[topic] = callbacks;
	} else {
		queue[topic].push(callback);
	}
	cometMessageCache.create_topic(topic);
	return
};

CometQueueHandler.prototype.process_queue = function (topic, message_id, message) {
	if (queue[topic] == undefined) {
		queue[topic] = new Array();
	}
	cometMessageCache.update_message(topic, message_id, message);
	while (queue[topic].length > 0) {
		callback = queue[topic].shift();
		send_comet_message(callback, message_id, message);
	}
	queue[topic] = new Array();
	return
};

function CometMessageCache() {
	store = new Array();
}

CometMessageCache.prototype.create_topic = function(topic) {
	if (store[topic] === undefined) {
		store[topic] = new Array();
	}
	return
};

CometMessageCache.prototype.is_topic_in_cache = function (topic) {
	return (topic in store); 
};

CometMessageCache.prototype.get_latest_time = function (topic) {
	if (this.is_topic_in_cache(topic)) {
		return store[topic]['timestamp'];
	} else {
		return false;
	}
};    

CometMessageCache.prototype.get_latest_id = function (topic) {
	if (this.is_topic_in_cache(topic)) {
		return store[topic]['id'];
	} else {
		return false;
	}
};

CometMessageCache.prototype.get_from_cache = function (topic) {
	if (this.is_topic_in_cache(topic)) {
		return store[topic];
	} else {
		return false;
	}
};

CometMessageCache.prototype.update_message = function (topic, id, body) {
	if (!this.is_topic_in_cache(topic)) {
		store[topic] = new Array();
	}
	store[topic]['body'] = body;
	store[topic]['id'] = id;
	store[topic]['timestamp'] = new Date().getTime();
	return
};

function StompQueueHandler() {
	stompQueue = new Array();
}

StompQueueHandler.prototype.process_request = function (callback, topics) {
	if (topics.constructor == Array) {
		for (var i = 0; i < topics.length; i++) {
			this.add_client(callback, topics[i]);
		}
	} else {
		this.add_client(callback, topics);
	}
};

StompQueueHandler.prototype.add_client = function (callback, topic) {
	if (topic.charCodeAt(topic.length-1)==13) {topic = topic.substring(0,topic.length-1);}
	if (stompQueue[topic] == undefined) {
		var callbacks = new Array(callback);
		stompQueue[topic] = callbacks;
	} else {
		stompQueue[topic].push(callback);
	}
	stompMessageCache.create_topic(topic);
	if (stompMessageCache.is_topic_in_cache(topic)) {
		
		var fromCache = stompMessageCache.get_from_cache(topic);
		send_stomp_message(callback, fromCache['id'], fromCache['body']);
	}
};

StompQueueHandler.prototype.remove_client = function (callback, topic) {
	if (stompQueue[topic] == undefined) {
		return
	}
	var i = 0;
	while (i < array.length) {
		if (stompQueue[topic][i] == callback) {
			stompQueue[topic].splice(i, 1);
		} else {
			i++;
		}
	}
};

StompQueueHandler.prototype.process_queue = function (topic, message_id, message) {
	if (stompQueue[topic] == undefined) {
		stompQueue[topic] = new Array();
	}
	stompMessageCache.update_message(topic, message_id, message);
	for (i=0;i<stompQueue[topic].length;i++) {
		send_stomp_message(stompQueue[topic][i],message_id,message);
	}
	return
};

function StompMessageCache() {
	stompStore = new Array();
}

StompMessageCache.prototype.create_topic = function(topic) {
	if (stompStore[topic] === undefined) {
		stompStore[topic] = new Array();
	}
	return
};

StompMessageCache.prototype.is_topic_in_cache = function (topic) {
	return (topic in stompStore); 
};

StompMessageCache.prototype.get_from_cache = function (topic) {
	if (this.is_topic_in_cache(topic)) {
		return stompStore[topic];
	} else {
		return false;
	}
};

StompMessageCache.prototype.update_message = function (topic, id, body) {
	if (!this.is_topic_in_cache(topic)) {
		stompStore[topic] = new Array();
	}
	stompStore[topic]['body'] = body;
	stompStore[topic]['id'] = id;
	return
};

function send_comet_message(callback, message_id, message) {
	try {
		callback.writeHead(200, {'RadioVIS-Message-ID':message_id,'Cache-Control':'no-store, no-cache, must-revalidate','Pragma':'no-cache'});
		callback.write(message);
		callback.end();
	} catch (err) {
		return
	}
}

function send_stomp_message(callback, message_id, message) {
	try {
		callback.write("MESSAGE\nmessage-id:ID:"+message_id+"\n\n"+message+"\n\0");
	} catch (err) {
		return
	}
}

function serve_file(path, request, callback) {
	if (path.indexOf('..') >= 0) {
		send_error(404, "Requested URL not found");
		return
	}
	if (path.indexOf('/',1)<0) {
		path = path + '/index.html';
	}
	
	fs.stat('.'+path, function (err, stats) {
		if (err) {
			sys.puts(err);
			send_error(callback, 404, "Requested URL not found");
			return
		}
    
		var size = stats['size'];
		var modified = stats['mtime'];
		if (Date.parse(request.headers['if-modified-since']) >= Date.parse(modified)) {
			callback.writeHead('304', {'Last-Modified':modified.toUTCString()});
			callback.end();  
			return
		}
		
		fs.readFile('.'+path, function (err, data) {
			if (err) {
				send_error(callback, 404, "Requested URL not found");
				return
			}
      		var ext = path.split('.')[-1];
      		var mime;
      		switch (ext) {
      			case "html":
      				mime = "text/html";
      				break;
      			case "htm":
      				mime = "text/html";
      				break;
      			case "js":
      				mime = "application/javascript";
      				break;
      			case "jpg":
      				mime = "image/jpeg";
      				break;
      			case "jpeg":
      				mime = "image/jpeg";
      				break;
      			case "png":
      				mime = "image/png";
      				break;
      			case "css":
      				mime = "text/css";
      				break;
      			default:
      				mime = "text/plain";
      		}
      
      		callback.writeHead(200, {'Content-Length':size,'Last-Modified':modified.toUTCString()});  
      		callback.write(data, "binary");  
      		callback.end();  
		});
	});
}

function send_error(callback, code, message) {
	callback.writeHead(code);
	callback.write(message);
	callback.end();
}
