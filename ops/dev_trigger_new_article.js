var Redis       = require('redis');
var Core        = require('sites-node-common');

try {
    Publisher = Redis.createClient(Core.Config.redis.port, Core.Config.redis.host);

    console.log('Running New Article event dispatcher...');

    setTimeout(function() {
        Publisher.publish('new_articles', '#21:0');
        console.log('...Event published!');
        Publisher.unref();
        process.exit(0);
    }, 1000);
}
catch(e) {
    console.log(e);
}
