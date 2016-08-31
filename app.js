// ----------------
//   Dependencies
// ----------------

var Server      = require('http').Server();
var Config      = require('./config.json');
var Util        = require('util');
var Domain      = require('domain');
var Redis       = require('redis');
var Core        = require('sites-node-common');

process.env.DEBUG = Config.debug_scope;
var io          = require('socket.io')(Server);

// Event Handlers
var NewArticleHandler   = require('./handlers/new_article');

// System Channels
Channels = {
    NEW_ARTICLES: 'new_articles'
}

// --------------------------
//   Middleware & Config
// --------------------------

io.use(function(socket, next) {
    var handshake = socket.request;

    Core.Auth.Tokens.Authenticate(handshake._query.auth_token, function(token) {
        if (token.is_valid) {
            if (token.user.password) {
                delete token.user.password;
            }

            // Valid logged in user
            LiveUsers.Add(handshake._query.auth_token, token);
            Util.log('Authorized: ' + handshake._query.auth_token);
            next();
        } else {
            // Invalid token
            Util.log('Unauthorized Access Attempt: ' + handshake._query.auth_token);
            next(new Error('Not Authorized'));
        }
    });
});

var LiveUsers = {
    index: {},
    count: 0,
    Add: function(token, user) {
        this.index[token] = user;
        this.index[token].status = 'pending';
        this.count++;
    },
    Remove: function(token) {
        delete this.index[token];
        this.count--;
    },
    Get: function(token) {
        return this.index[token] || false;
    }
};

// --------------------------
//   Server Events
// --------------------------

var d = Domain.create();

d.run(function() {
    io.on('connection', function (socket) {
        var token = socket.handshake.query.auth_token;
        var user = LiveUsers.Get(token);

        /**
         * New User has Connected
         */
        Util.log('New Connection: ' + token);
        Util.log('Live Users: ' + LiveUsers.count);
        user.status = 'connected';
        user.subscriber = Redis.createClient(Core.Config.redis.port, Core.Config.redis.host);
        socket.emit('log', 'Welcome to MyNews.com Socket Server');

        /**
         * User has Disconnected
         */
        socket.on('disconnect', function () {
            LiveUsers.Remove(token);
            Util.log('...disconnected: ' + token);
            Util.log('Live Users: ' + LiveUsers.count);
        });

        /**
         * Subscription Request
         *   - User is subscribing to some data channel
         */
        socket.on('subscribe', function (message) {
            if (message && message.channel) {
                user.subscriber.subscribe(message.channel);
                socket.emit('subscription_ready', message);
                socket.emit('log', 'Subscribed to [' + message.channel.toString() + ']');
            } else {
                socket.emit('log', 'Failed to subscribe to [' + message.channel.toString() + ']');
            }
        });

        // -----------------------------
        //   Redis Subscription Events
        // -----------------------------

        /**
         * Subscription Event
         *   - A channel the user is subscribed to as new data
         */
        user.subscriber.on('message', function (channel, event) {
            Util.log('User (' + token + ') Channel Message: [' + channel + '] :: ' + event.toString());

            console.log(event);

            switch (channel) {
                case Channels.NEW_ARTICLES:

                    // --
                    // Process a new Article the user may wish to see.
                    // --

                    try {
                        NewArticleHandler.Filter_ByUserFeedSettings(event, user.user['@rid'], function (e, show, article) {
                            if (e) {
                                console.log(e);
                                return;
                            } else if (!e || show) { // Fix
                                console.log('Publishing New Article to User');
                                socket.emit('subscription_event', {
                                    channel: channel,
                                    event: article
                                });
                            }
                        });
                        break;
                    }
                    catch (e) {
                        console.log(e);
                    }


                default:

                    // --
                    // All other event types
                    // --

                    socket.emit('subscription_event', {
                        channel: channel,
                        event: event
                    });
                    break;
            }
        });

        /**
         * User has subscribed to a new channel
         */
        user.subscriber.on('subscribe', function (channel, count) {
            Util.log('User (' + token + ') Subscribed to Channel: [' + channel + '] :: ' + count.toString());
        });

        /**
         * User has unsubscribed from a channel
         */
        user.subscriber.on('unsubscribe', function (channel, count) {
            Util.log('User (' + token + ') Subscribed to Channel: [' + channel + '] :: ' + count.toString());
        });

    });
});

d.on('error', function(er) {
    console.log(er);
});

// ----------------
//   Start Server
// ----------------

Core.Database.connect(Core.Config, function(e) {
    if (e) {
        Util.log(e);
        Util.log("MyNews.com WS Server shutting down...");
    } else {
        Util.log("OrientDB connection available.");

        Server.listen(Config.port);
        Util.log('Listening on port ' + Config.port);
    }
})
