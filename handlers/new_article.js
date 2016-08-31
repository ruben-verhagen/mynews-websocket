// -------------------
//   Dependencies
// -------------------

var Core    = require('sites-node-common');
var Async   = require('async');

// Models
var Article             = Core.Models.Article;
var User                = Core.Models.User;

/**
 * Article Cache
 * -- Auto purges after 30 seconds of
 *    inactivity.
 */

var ArticleCache = {
    index: {},
    Get: function(id) {
        var that = this;

        if (this.index[id]) {
            clearTimeout(this.index[id].timeout);
            this.index[id].timeout = setTimeout(function() {
                console.log('Purging', id);
                delete that.index[id];
            }, 30000);

            return this.index[id].data;
        } else {
            return false;
        }
    },
    Set: function(article) {
        var that = this;

        if (this.index[article['@rid']]) {
            clearTimeout(this.index[article['@rid']].timeout);
        }

        this.index[article['@rid']] = {
            data: article,
            timeout: setTimeout(function() {
                console.log('Purging', article['@rid']);
                delete that.index[article['@rid']];
            }, 30000)
        }
    }
}

// --------------------------
//   Handler Definition
// --------------------------

var NewArticleHandler = {};

/**
 * Processes the Article to determine if it should show in the
 * supplied User's feed.
 *
 * @param   String      article_id  Article id to process
 * @param   String      user_id     User to use for feed settings
 * @param   func        cb          Completion callback
 * @returns obj
 */
NewArticleHandler.Filter_ByUserFeedSettings = function(article_id, user_id, cb) {

    Async.parallel({
        feed_settings: function(done) {
            User.Find({ where: { '@rid': user_id }}, function(e, user) {
                if (e) {
                    done(e);
                } else {
                    user.get_feed_settings(function(e, feedSettings){
                        if (e) {
                            done(e);
                        } else if (!feedSettings) {
                            done(new Error('Invalid Feed Settings'));
                        } else {
                            //user.feed_settings = feedSettings;
                            done(null, feedSettings);
                        }
                    });
                }
            });
        },
        article: function(done) {
            var article = ArticleCache.Get( article_id );

            if (!article) {

                console.log('Article not cached...');

                // --
                // Article is not in Cache, rebuild it
                // --

                Article.Find({ where: { '@rid': article_id }}, function(e, article) {
                    if (e) {
                        done(e);
                    } else if (!article) {
                        done(new Error('Article does not exist.'));
                    } else {
                        Async.parallel({
                            meta: function(finished) {
                                article.fetch_meta(function(e) {
                                    if (e) {
                                        finished(e)
                                    } else {
                                        finished(null, article);
                                    }
                                });
                            },
                            tags: function(finished) {
                                try {
                                    article.get_tags(function(e, tags) {
                                        if (e) {
                                            finished(e)
                                        } else {
                                            finished(null, tags);
                                        }
                                    });
                                }
                                catch(e) {
                                    console.log(e);
                                }

                            }
                        }, function(errors, res) {
                            if (errors) {
                                done(errors);
                            } else {
                                try {
                                    article.tags = res.tags;
                                    ArticleCache.Set(article);
                                    done(null, article);
                                }
                                catch(e) {
                                    console.log(e);
                                }

                            }
                        });
                    }
                });
            } else {

                console.log('Article was cached...');

                // --
                // Article is in Cache, return it
                // --

                done(null, article);
            }
        }
    }, function(errors, res) {
        if (errors) {
            console.log(errors);
            cb(errors);
        } else {
            var article = res.article;
            var feed_settings = res.feed_settings;

            var checks = {
                tags: false,
                publisher: false,
                journalist: false,
                //rating: false
            }

            // --
            // Check if the Article has Tags we desire.
            // --

            try {
                feed_settings.tags.forEach(function(desired_tag) {
                    article.tags.forEach(function(article_tag) {
                        if (desired_tag['@rid'] == article_tag['@rid']) {
                            checks.tags = true;
                        }
                    });
                });

                // --
                // Check if the Publisher is one we desire.
                // --

                feed_settings.publishers.forEach(function(desired_pub) {
                    if (desired_pub['@rid'] == article.publisher['@rid']) {
                        checks.publisher = true;
                    }
                });

                // --
                // Check if the Journalist is one we desire.
                // --

                feed_settings.journalists.forEach(function(desired_journalist) {
                    if (desired_journalist['@rid'] == article.journalist['@rid']) {
                        checks.journalist = true;
                    }
                });

                // --
                // Check if the Article's rating is equal or above the desired threshold.
                // --

                //if (feed_settings.avg_article_rating >= article.rating) {
                //    checks.rating = true;
                //}
            }
            catch (e) {
                console.log(e);
            }

            // --
            // Final Verification
            // --

            var show_to_user = true;
            for (var i in checks) {
                if (!checks[i]) {
                    show_to_user = false;
                    break;
                }
            }

            console.log('Checks', checks);

            cb(null, show_to_user, article);
        }
    });
}

module.exports = NewArticleHandler;