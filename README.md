# node-red-contrib-job-queue

A pair of queue nodes where you can write code to run in the background as a queued job which is used OptimalBits/bull library as the core of job management.

**Queue In:** start a job by name with msg.payload as the job.data of the queue job.

**Queue Out:** run a job by name as a background nodejs function which is managed through a redis server. 

The message is passed in as a JavaScript object called msg.job and msg.done object to the job function.

By convention it will pass a whole msg object to the job.data as the parameter of the queue function.

**Queued job management:**

When writting a queued execution code, these funcions are available:

```javascript
job.progress(50)
done()
done(Error('error transcoding'))
done(null, { message: "Passing result..." })
```

**Circuit breaker support:**

Inside the function context, Hystrix-like circuit-breaker-js is supported as CirCuitBreaker object:

```javascript
var breaker = new CircuitBreaker(); 
var command = function(success, failed) { doSomething().done(success).fail(failed); }; 
var fallback = function() { alert("Service is down"); }; 
breaker.run(command, fallback);
```

**Logging and Error Handling**

To log any information, or report an error, the following functions are available:

```javascript
node.log("Log")
node.warn("Warning")
node.error("Error")
```

The Catch node can also be used to handle errors. To invoke a Catch node, pass msg as a second argument to node.error:

```javascript
node.error("Error",msg)
```

**Sending messages**

The function can either return the messages it wants to pass on to the next nodes in the flow, or can call node.send(messages).

It can return/send:

a single message object - passed to nodes connected to the first output
an array of message objects - passed to nodes connected to the corresponding outputs
If any element of the array is itself an array of messages, multiple messages are sent to the corresponding output.

If null is returned, either by itself or as an element of the array, no message is passed on.