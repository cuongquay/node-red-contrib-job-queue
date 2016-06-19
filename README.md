# node-red-contrib-job-queue

A pair of queue nodes where you can write code to run in the background as a queued job which is used OptimalBits/bull library as the core of job management.

**Queue In:** start a job by name with msg.payload as the job.data of the queue job.

**Queue Out:** run a job by name as a background nodejs function which is managed through a redis server. 

Full example job function code:

```javascript

// transcode image asynchronously and report progress
job.progress(42);
console.log("Running.....", job.data, job.opts);

setTimeout(function(){ 
    // call done when finished
    done(null, {
        "Hello": "CuongQuay"
    });
}, 5000); 

return msg;

```

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

##License

(The MIT License)

Copyright (c) 2016 Duong Dinh Cuong <cuong3ihut@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.