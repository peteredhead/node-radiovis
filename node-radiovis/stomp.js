var util = require('util'),
	net = require('net');

function Server(port) {
    var stompServer = net.createServer(connectionListener);
    stompServer.listen(port);
    stompServer.addListener("error", function() {});
}

function extractDestination(cmd) {
    topic = null;
    for (line in cmd) {
	    if ((topic == null) && (cmd[line].indexOf('destination:')==0)) {
		    topic = cmd[line].substring(12).replace(/\r/g,'');
			topic=topic.replace(/^\s+/,"");
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

function connectionListener(c) {
	var buffer = '';
	var connected = false;
	var self = this;
	c.setEncoding('utf8');
	c.on('connect', function () { });
	    util.debug('STOMP - client opened socket');
	
	c.on('data', function (data) {
		buffer = buffer + data;
		if (data.indexOf(String.fromCharCode(0))>=0) {
			while (buffer.indexOf(String.fromCharCode(0))>=0) {
				// Take the first line as the command - ie CONNECT, SUBSCRIBE, UNSUBSCRIBE, DISCONNECT
				var buffer_array = buffer.split("\n");
				var command = '';
				for (var i = 0; i < buffer_array.length; i++) {
					if (buffer_array[i].length>1) {
						command = buffer_array[i];
						break;
					}
				}
				switch (command.replace(/\s/g,'')) {
					case 'CONNECT':
						connected = true;
						util.debug('STOMP - CONNECT received');
						c.write("CONNECTED\n");
						c.write("session: 6861707079636174\r\n\r\n\0");
						break;
					case 'SUBSCRIBE':
						util.debug('SUBSCRIBE received');
						if (!connected) {
							c.write("ERROR - Not connected\r\n\0");
							break;
						}
						topic = extractDestination(buffer_array);
						util.debug('Subscribing to :'+topic);
						if (!topic) {
							c.write("ERROR - No destination specified\r\n\0");
							break;
						}
						if (!checkValidTopic(topic)) {
							c.write("ERROR - Invalid topic name\r\n\0");
							break;
						}
						stompQueueHandler.add_client(c, topic);
						break;
					case 'UNSUBSCRIBE':
						if (!connected) {
							c.write("ERROR - Not connected\r\n\0");
							break;
						}
						stompQueueHandler.remove_client(c, topic);
						break;
					case 'DISCONNECT':
					    util.debug('STOMP - DISCONNECT received');
						c.end();
						break;
					default:
					    util.debug('STOMP - unrecognised command '+buffer_array[0]+' received');
						c.write('ERROR - Unrecognised command '+buffer_array[0]+"\n\0");
				}
				// Had a command, remove from the command buffer
				var pos = buffer.indexOf(String.fromCharCode(0));
				buffer = buffer.substring((pos+1));
			}
		}
	});

	c.on('end', function () {
	    util.debug('STOMP - TCP connection closed');
		c.end();
	});
}

function QueueHandler() {
	stompQueue = new Array();
}

QueueHandler.prototype.process_request = function (callback, topics) {
	if (topics.constructor == Array) {
		for (var i = 0; i < topics.length; i++) {
			this.add_client(callback, topics[i]);
		}
	} else {
		this.add_client(callback, topics);
	}
};

QueueHandler.prototype.add_client = function (callback, topic) {
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
		this.send_message(callback, fromCache['id'], topic, fromCache['body']);
	}
};

QueueHandler.prototype.remove_client = function (callback, topic) {
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

QueueHandler.prototype.process_queue = function (topic, message_id, message) {
	if (stompQueue[topic] == undefined) {
		stompQueue[topic] = new Array();
	}
	stompMessageCache.update_message(topic, message_id, message);
	for (i=0;i<stompQueue[topic].length;i++) {
		this.send_message(stompQueue[topic][i],message_id, topic, message);
	}
	return
};

QueueHandler.prototype.send_message = function(callback, message_id, topic, message) {
	try {
		callback.write("MESSAGE\n"+
		                "message-id:ID:"+message_id+"\n"+
		                "destination:"+topic+"\n"+
		                "trigger-time:NOW\n"+
		                "\n"+
		                message+"\n"+
		                "\0");
	} catch (err) {
		return
	}
}

function MessageCache() {
	stompStore = new Array();
}

MessageCache.prototype.create_topic = function(topic) {
	if (stompStore[topic] === undefined) {
		stompStore[topic] = new Array();
	}
	return
};

MessageCache.prototype.is_topic_in_cache = function (topic) {
	return (topic in stompStore); 
};

MessageCache.prototype.get_from_cache = function (topic) {
	if (this.is_topic_in_cache(topic)) {
		return stompStore[topic];
	} else {
		return false;
	}
};

MessageCache.prototype.update_message = function (topic, id, body) {
	if (!this.is_topic_in_cache(topic)) {
		stompStore[topic] = new Array();
	}
	stompStore[topic]['body'] = body;
	stompStore[topic]['id'] = id;
	return
};

exports.Server = Server;
exports.QueueHandler = QueueHandler;
exports.MessageCache = MessageCache;