MyNews.com WebSocket Server
===========

Backend for real-time events via Socket.io (http://socket.io).

This process drives live feed updates, push notifications, and more. Falls back to long-polling, or flash socket when the client
browser does not support HTML5's WebSocket API.

This process runs in cluster environments for horizontal load balancing.

## Configuration

Configured via `config.json`


## Running Process

    node app


## Testing

Summarized:

    grunt test

Full Report:

    grunt test_report


## Developer Operations

Push an Article into the 'new_articles' channel:

    node ops/dev_trigger_new_article
