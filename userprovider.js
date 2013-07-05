/**
 * Created with IntelliJ IDEA.
 * User: Ofer
 * Date: 05/06/13
 * Time: 15:02
 * To change this template use File | Settings | File Templates.
 */

var mongodb = require('mongodb');
var Db = mongodb.Db;
var Connection = mongodb.Connection;
var Server = mongodb.Server;
var BSON = mongodb.BSONPure;
var ObjectID = mongodb.ObjectID;
var assert = require('assert');

UserProvider = function (host, port) {
    this.db = new Db('node-mongo-CrowdOpinionF', new Server(host, port, {safe: false}, {auto_reconnect: true}, {}));
    this.db.open(function () {
    });
};

// The number of mili seconds until login is expires
//UserProvider.prototype.loginValidDurationMs = 1000 * 60 * 60 * 24 * 7; // Week
UserProvider.prototype.loginValidDurationMs = 1000 * 60 * 60 * 5; // 5 hours
//UserProvider.prototype.loginValidDurationMs = 1000 * 20; // 20secs


UserProvider.prototype.getCollection = function (callback) {
    if(!this.db.serverConfig.isConnected()) {
        callback("Db is not connected!");
        return;
    }

    this.db.collection('users', function (error, user_collection) {
        if (error) {
            callback(error);
        }
        else {
            callback(null, user_collection);
        }
    });
};

// find all users
UserProvider.prototype.findAll = function (callback) {
    this.getCollection(function (error, user_collection) {
        if (error) callback(error)
        else {
            user_collection.find().toArray(function (error, results) {
                if (error) callback(error)
                else callback(null, results)
            });
        }
    });
};

// save new user
UserProvider.prototype.save = function (user, callback) {

    if (typeof(user.length) != "undefined") {
        callback("Error:Input can't be an array!");
        return;
    }

    if (!user.email_address || !user.full_name || !user.password) {
        callback("Error:Some fields are missing!");
        return;
    }

    var provider = this;

    this.is_user_mail_exist(user.email_address, function (err, user_exist) {

            if (err) {
                callback(err.message);
                return;
            }
            if (user_exist) {
                callback("Error: This email address already belongs to another user!");
                return;
            }

            var new_user = {};
            new_user.email_address = user.email_address;
            new_user.full_name = user.full_name;
            new_user.hashed_password = calc_sha1(user.password);
            new_user.created_at = new Date();
            new_user.remaining_coins = 100;
            new_user.last_connection = new Date();
            new_user.votes = [];

            // Insert new user to DB
            provider.getCollection(function (error, user_collection) {
                if (error) {
                    callback(error);
                }
                else {
                    user_collection.insert(new_user, function () {
                        callback(null, new_user);
                    });
                }
            });
        }
    );
};

// Calls the callback with (error, is_valid - true/false, user/null).
UserProvider.prototype.loginUser = function (user, callback) {

    var provider = this;
    this.getCollection(function (error, user_collection) {
        if (error) {
            callback(error);
        }
        else {

            if (typeof(user.length) != "undefined") {
                callback("Error:Input can't be an array!");
                return;
            }

            if (!user.email_address || !user.password) {
                callback("Error:Some fields are missing!");
                return;
            }

            provider.find_first_user_by_email(user.email_address, function (err, db_user) {
                    if (err) {
                        callback(err.message);
                        return;
                    }
                    if (!db_user) {
                        callback(null, false);
                        return;
                    }

                    if (calc_sha1(user.password) != db_user.hashed_password) {
                        callback(null, false);
                        return;
                    } else { // Login is valid!
                        // Update last connection time
                        user_collection.update({ _id: db_user._id }, { $set: { last_connection: new Date() }});
                        callback(null, true, db_user);
                        return;
                    }
                }
            );
        }
    });
};

// Calls the callback with (error, is_logged_in - true/false).
// If the user login is still valid, updates the last connection time so that the expiry date will be postponed too.
UserProvider.prototype.isUserLoggedIn = function (user_id, callback) {

    if (!user_id) {
        callback("Error:No user sent!");
        return;
    }

    var provider = this;
    this.find_first_user_by_id(user_id, function (err, db_user) {
            if (err) {
                callback(err.message);
                return;
            }
            if (!db_user) {
                callback("Could not locate user in DB!");
                return;
            }

            var timePassed =  new Date() - db_user.last_connection;
            if ( timePassed > provider.loginValidDurationMs) { // Too much time has passed!
                callback(null, false);
                return;
            } else { // User is loggedIn!
                // Update last connection time
                provider.getCollection(
                    function (error, user_collection) {
                        if (error) {
                            callback(error);
                        }
                        else {
                            user_collection.update({ _id: db_user._id }, { $set: { last_connection: new Date() }});
                        }
                    }
                );
                callback(null, true);
                return;
            }
        }
    );

};

// Calls the callback with (error, is_valid - true/false).
// Updates the last connection time so that the expiry date will be postponed too.
UserProvider.prototype.login_user = function (user, callback) {

    if (typeof(user.length) != "undefined") {
        callback("Error:Input can't be an array!");
        return;
    }

    if (!user.email_address || !user.password) {
        callback("Error:Some fields are missing!");
        return;
    }

    var provider = this;
    this.find_first_user_by_email(user.email_address,
        function (err, db_user) {
            if (err) {
                callback(err.message);
                return;
            }
            if (!db_user) {
                callback(null, false);
                return;
            }

            if (calc_sha1(user.password) != db_user.hashed_password) {
                callback(null, false);
                return;
            } else { // Login is valid!
                // Update last connection time
                provider.getCollection(
                    function (error, user_collection) {
                        if (error) {
                            callback(error);
                        }
                        else {
                            user_collection.update({ _id: db_user._id }, { $set: { last_connection: new Date() }});
                        }
                    }
                );

                callback(null, true, db_user);
                return;
            }
        }
    );

};

// Returns the hashed password.
function calc_sha1(clear_pass) {
    var crypto = require('crypto');
    var shasum = crypto.createHash('sha1');
    shasum.update(clear_pass);
    return shasum.digest('hex');
}

// Calls the callback with (Error, true or false).
UserProvider.prototype.is_user_mail_exist = function (user_email, callback) {
    this.getCollection(function (error, user_collection) {
        if (error) {
            // "throw" the error safely by returning it
            callback(new Error(error));
        }
        else {
            user_collection.find({email_address: user_email}).count(function (err, count) {
                if (err) {
                    callback(new Error(err));
                } else {
                    callback(null, (count != 0));
                }
            });
        }
    });
};

// Calls the callback with (Error, null or the user)
UserProvider.prototype.find_first_user_by_id = function (user_id, callback) {
    this.getCollection(function (error, user_collection) {
        if (error) {
            // "throw" the error safely by returning it
            callback(new Error(error));
        }
        else {
            var o_id = new BSON.ObjectID(user_id);
            user_collection.find({_id: o_id}).toArray(function (err, documents) {
                if (err) {
                    callback(new Error(err));
                }
                if (documents.length == 0) {
                    callback(null, null);
                } else {
                    callback(null, documents[0]);
                }
            });
        }
    });
};

// Calls the callback with (Error, null or the user)
UserProvider.prototype.find_first_user_by_email = function (user_email, callback) {
    this.getCollection(function (error, user_collection) {
        if (error) {
            // "throw" the error safely by returning it
            callback(new Error(error));
        }
        else {
            user_collection.find({email_address: user_email}).toArray(function (err, documents) {
                if (err) {
                    callback(new Error(err));
                }
                if (documents.length == 0) {
                    callback(null, null);
                } else {
                    callback(null, documents[0]);
                }
            });
        }
    });
};

exports.UserProvider = UserProvider;