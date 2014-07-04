var request = require('superagent'),
    Nodewhal = require('nodewhal'),
    RSVP = require('rsvp'),
    express = require('express'),
    lastPostId = null, clients = [];

setupServer();
Nodewhal.schedule.repeat(function() {
  return fetchPosts().then(function(posts) {posts.forEach(processPost)});
}, 30000);

function fetchPosts() {
  return (new RSVP.Promise(function(resolve, reject) {
    request.get("http://api.redditanalytics.com/getPosts?limit=500")
      .set('Accept', 'application/json')
      .end(function(error, res) {
        if (error) {
          reject(error);
        } else {
          resolve(res)
        }
      });
  })).then(function(response) {
    if (!response.body.data) {return [];}
    return response.body.data.reverse();
  });
}

function processPost(post) {
  if (post.id > lastPostId || !lastPostId) {
    lastPostId = post.id;
    clients.forEach(function(client) {
      processPostForClient(client, post);
    });
    return true;
  }
}

function processPostForClient(client, post) {
  if (client.req.query.subreddit) {
    var subs = client.req.query.subreddit.split(' ');
    if (subs.indexOf(post.subreddit) === -1) {return;}
  }
  if (client.req.query.title) {
    var title = client.req.query.title.toLowerCase();
    if (post.title.toLowerCase().indexOf(title) === -1) {return;}
  }
  client.res.write('data: ' + JSON.stringify(post) + '\n\n');
}

function setupServer() {
  var app = express();
  app.get('/submission_stream', function(req, res) {
    var client = {req: req, res: res}, pingInterval;
    res.writeHead(200, {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Session": "keep-alive"
    });
    res.write('retry: ' + 15000 + '\n');
    clients.push(client);
    pingInterval = setInterval(function() {res.write('\n\n');}, 10000);
    res.on('close', function() {
      if (pingInterval) {clearInterval(pingInterval);}
      var index = clients.indexOf(client);
      if (index !== -1) {clients.splice(index, 1);}
    });
  });
  app.listen(4243);
}
