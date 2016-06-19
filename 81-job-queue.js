/**
 * Copyright 2013,2015 IBM Corp.
 *
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
 **/

module.exports = function(RED) {
	"use strict";
	var q = require('q');
	var util = require("util");
	var vm = require("vm");
	var Queue = require("bull");
	var CircuitBreaker = require("circuit-breaker-js");

	function QueueServerSetup(n) {
		RED.nodes.createNode(this, n);

		this.connected = false;
		this.connecting = false;
		this.usecount = 0;
		// Config node state
		this.name = n.name;
		this.address = n.address;
		this.port = n.port;

		var node = this;
		this.register = function() {
			node.usecount += 1;
		};

		this.deregister = function() {
			node.usecount -= 1;
			if (node.usecount == 0) {
			}
		};

		this.connect = function() {
			var deferred = q.defer();
			if (!node.connected && !node.connecting) {
				node.connecting = true;
				node.queue = Queue(node.name, node.port, node.address);
				node.log(RED._("connected", {
					server : (node.address ? node.address + "@" : "") + node.port
				}));
				node.connecting = false;
				node.connected = true;
				node.emit('connected');
				deferred.resolve(node.queue);
			} else {
				if (node.queue) {
					deferred.resolve(node.queue);
				}
			}
			return deferred.promise;
		};

		this.on('close', function(closecomplete) {
			if (this.connected) {
				this.on('disconnected', function() {
					closecomplete();
				});
				delete node.queue;
			} else {
				closecomplete();
			}
		});
	}


	RED.nodes.registerType("queue-server", QueueServerSetup);

	function sendResults(node, _msgid, msgs) {
		if (msgs == null) {
			return;
		} else if (!util.isArray(msgs)) {
			msgs = [msgs];
		}
		var msgCount = 0;
		for (var m = 0; m < msgs.length; m++) {
			if (msgs[m]) {
				if (util.isArray(msgs[m])) {
					for (var n = 0; n < msgs[m].length; n++) {
						msgs[m][n]._msgid = _msgid;
						msgCount++;
					}
				} else {
					msgs[m]._msgid = _msgid;
					msgCount++;
				}
			}
		}
		if (msgCount > 0) {
			node.send(msgs);
		}
	};

	function QueueInNode(n) {
		RED.nodes.createNode(this, n);
		var node = this;
		this.name = n.name;
		this.queue = n.queue;
		this.Queue = RED.nodes.getNode(this.queue);
		this.topic = n.topic;
		if (node.Queue) {
			node.Queue.register();
			node.Queue.connect().then(function(queue) {
				node.status({
					fill : "green",
					shape : "ring",
					text : "connected"
				});
			}, function(error) {
				node.status({
					fill : "red",
					shape : "ring",
					text : "disconnected"
				});
			});
		} else {
			node.error(RED._("common.status.error"));
		}
		try {
			this.on("input", function(msg) {
				node.Queue.connect().then(function(queue) {
					node.log(RED._("queue.add()", queue));
					queue.add(msg, {
						name : node.name,
						topic : node.topic
					});
				}, function(error) {
					node.status({
						fill : "red",
						shape : "ring",
						text : "disconnected"
					});
				});
			});
		} catch(err) {
			// eg SyntaxError - which v8 doesn't include line number information
			// so we can't do better than this
			this.error(err);
		}
	}
	
	function QueueOutNode(n) {
		RED.nodes.createNode(this, n);
		var node = this;
		this.name = n.name;
		this.func = n.func;
		this.queue = n.queue;
		this.Queue = RED.nodes.getNode(this.queue);
		var functionText = "var results = null;" + "results = (function(msg){ " + "var __msgid__ = msg._msgid;" + "var node = {" + "log:__node__.log," + "error:__node__.error," + "warn:__node__.warn," + "on:__node__.on," + "status:__node__.status," + "send:function(msgs){ __node__.send(__msgid__,msgs);}" + "};\n" + this.func + "\n" + "})(msg);";
		this.topic = n.topic;
		var sandbox = {
			console : console,
			util : util,
			Buffer : Buffer,
			__node__ : {
				log : function() {
					node.log.apply(node, arguments);
				},
				error : function() {
					node.error.apply(node, arguments);
				},
				warn : function() {
					node.warn.apply(node, arguments);
				},
				send : function(id, msgs) {
					sendResults(node, id, msgs);
				},
				on : function() {
					node.on.apply(node, arguments);
				},
				status : function() {
					node.status.apply(node, arguments);
				}
			},
			context : {
				global : RED.settings.functionGlobalContext || {}
			},
			setTimeout : setTimeout,
			clearTimeout : clearTimeout
		};
		var context = vm.createContext(sandbox);
		if (node.Queue) {
			node.Queue.register();
			node.script = vm.createScript(functionText);
			node.Queue.connect().then(function(queue) {
				queue.process(function(job, done) {
					node.log(RED._("queue.run()", job));
					try {
						var start = process.hrtime();
						context.msg = job.data;
						context.job = job;
						context.done = done;
						context.CircuitBreaker = CircuitBreaker;
						node.script.runInContext(context);
						sendResults(node, node.name, context.results);

						var duration = process.hrtime(start);
						var converted = Math.floor((duration[0] * 1e9 + duration[1]) / 10000) / 100;
						node.metric("duration", node.name, converted);
						if (process.env.NODE_RED_FUNCTION_TIME) {
							node.status({
								fill : "yellow",
								shape : "dot",
								text : "" + converted
							});
						}
					} catch(err) {
						var line = 0;
						var errorMessage;
						var stack = err.stack.split(/\r?\n/);
						if (stack.length > 0) {
							while (line < stack.length && stack[line].indexOf("ReferenceError") !== 0) {
								line++;
							}
							if (line < stack.length) {
								errorMessage = stack[line];
								var m = /:(\d+):(\d+)$/.exec(stack[line + 1]);
								if (m) {
									var lineno = Number(m[1]) - 1;
									var cha = m[2];
									errorMessage += " (line " + lineno + ", col " + cha + ")";
								}
							}
						}
						if (!errorMessage) {
							errorMessage = err.toString();
						}
						node.error(errorMessage, node.name);
					}
				});
				node.status({
					fill : "green",
					shape : "ring",
					text : "connected"
				});
			}, function(error) {
				node.status({
					fill : "red",
					shape : "ring",
					text : "disconnected"
				});
			});
		} else {
			node.error(RED._("common.status.error"));
		}
	}

	RED.nodes.registerType("job-queue in", QueueInNode);
	RED.nodes.registerType("job-queue out", QueueOutNode);
	RED.library.register("functions");
};
