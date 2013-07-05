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

UserProvider = require('./userprovider').UserProvider;
var userProvider = new UserProvider(GLOBAL.mongo_host, GLOBAL.mongo_port);


var PAYMENT_PER_VOTE = 1;

QuestionProvider = function (host, port) {
    this.db = new Db('node-mongo-CrowdOpinionF', new Server(host, port, {safe: false}, {auto_reconnect: true}, {}));
    this.db.open(function () {
    });
};


QuestionProvider.prototype.getCollection = function (callback) {
    if (!this.db.serverConfig.isConnected()) {
        callback("Db is not connected!");
        return;
    }

    this.db.collection('questions', function (error, question_collection) {
        if (error) {
            callback(error);
        }
        else {
            callback(null, question_collection);
        }
    });
};

// save new question
QuestionProvider.prototype.submitQuestion = function (user_id, question, callback) {

    if (typeof(question.length) != "undefined") {
        callback("Error: Input can't be an array!");
        return;
    }

    if (!user_id || !question.question_string || !question.required_answers || !question.image_1 || !question.image_2) {
        callback("Error: Some fields are missing!");
        return;
    }

    if (question.required_answers < 0) {
        callback("Error: Number of required answers (aka coins) must be positive!");
        return;
    }

    var provider = this;
    userProvider.find_first_user_by_id(user_id, function (err, db_user) {
            if (err) {
                callback(err.message);
                return;
            }
            if (!db_user) {
                callback("Error: Couldn't recognize the user!");
                return;
            }

            // Check that the user have enough tokens for this action
            if (question.required_answers > db_user.remaining_coins) {
                callback("Error: You don't have enough coins!");
                return;
            }

            var new_question = {};
            new_question.user_id = user_id;
            new_question.created_at = new Date();
            new_question.closed_at = "";
            new_question.question_string = question.question_string;
            new_question.required_answers = question.required_answers;
            new_question.image_1 = question.image_1;
            new_question.image_1_votes = 0;
            new_question.image_2 = question.image_2;
            new_question.image_2_votes = 0;
            new_question.status = 'open';

            // Update user number of coins
            var new_coins_num = db_user.remaining_coins - question.required_answers;
            userProvider.getCollection(
                function (error, user_collection) {
                    if (error) {
                        callback(error);
                    }
                    else {
                        user_collection.update({ _id: db_user._id }, { $set: { remaining_coins: new_coins_num }});
                    }
                }
            );

            provider.getCollection(
                function (error, question_collection) {
                    if (error) {
                        callback(error);
                    }
                    else {
                        question_collection.insert(new_question, {safe: true}, function (err, inserted_question) {
                            if (err) {
                                callback(err);
                                return;
                            }
                            callback(null, inserted_question[0]._id);

                        });
                    }
                }
            );
        }
    );
};


// get all user questions
QuestionProvider.prototype.getAllUserQuestions = function (user_id, callback) {


    if (!user_id) {
        callback("Error:Some fields are missing!");
        return;
    }

    this.getCollection(
        function (error, question_collection) {
            if (error) {
                callback(error);
            }
            else {
                question_collection.find({user_id: user_id}).toArray(function (err, documents) {
                    if (err) {
                        callback(new Error(err));
                    }
                    if (documents.length == 0) {
                        callback("You didn't ask any question, yet.");
                    } else {
                        callback(null, documents);
                    }
                });
            }
        }
    );
};

// Vote on a question
QuestionProvider.prototype.voteQuestion = function (user_id,question_vote, callback) {

    if (!user_id || !question_vote) {
        callback("Error: Some fields are missing!");
        return;
    }

    if (typeof(question_vote.length) != "undefined") {
        callback("Error: Input can't be an array!");
        return;
    }

    this.getCollection(
        function (error, question_collection) {
            if (error) {
                callback(error);
            }
            else {
                var o_id = new BSON.ObjectID(question_vote.question_id);
                question_collection.findOne({_id: o_id}, function(err, doc) {
                    if (err) {
                        callback(err);
                        return;
                    }
                    if (!doc) {
                        callback("Error: Didn't find question!");
                        return;
                    }

                    var image_1_votes = doc.image_1_votes;
                    var image_2_votes = doc.image_2_votes;

                    if(1 == question_vote.image_voted) {
                        image_1_votes++;
                    } else if (2 == question_vote.image_voted) {
                        image_2_votes++;
                    } else {
                        callback("Error: image_voted contains bad value!");
                        return;
                    }

                    var status = "open";
                    var closed_at =  doc.closed_at;
                    if ((image_1_votes + image_2_votes) >= doc.required_answers) {
                        status = "closed";
                        if(!closed_at) {
                            closed_at = new Date();
                        }
                    }

                    question_collection.update({ _id: o_id }, { $set: { image_1_votes: image_1_votes, image_2_votes:image_2_votes, status:status, closed_at:closed_at }});

                    userProvider.getCollection(
                        function (error, user_collection) {
                            if (error) {
                                callback(error);
                                return;
                            }
                            else {
                                var user_o_id = new BSON.ObjectID(user_id);
                                user_collection.update({ _id: user_o_id}, { $inc: { remaining_coins: PAYMENT_PER_VOTE }, $addToSet: { votes: o_id } });
                                callback(null);
                                return;
                            }
                        }
                    );

                });
            }
        }
    );
};

QuestionProvider.prototype.getRandomQuestion = function (user_id, callback) {

    if (!user_id) {
        callback("Error:Some fields are missing!");
        return;
    }

    this.getCollection(
        function (error, question_collection) {
            if (error) {
                callback(error);
            }
            else {

                userProvider.find_first_user_by_id(user_id, function (err, db_user) {
                    if (err) {
                        callback(err.message);
                        return;
                    }
                    if (!db_user) {
                        callback("Error: Couldn't recognize the user!");
                        return;
                    }

                    var voted = db_user.votes;


                    question_collection.find({user_id: {$ne: user_id }, _id: { $nin: voted } ,status:'open'}).toArray(function (err, questions) {
                        if (err) {
                            callback(new Error(err));
                        }
                        var len =  (questions)? questions.length : 0;
                        if (0 == len) {
                            callback("There are no questions to show!");
                        } else {
                            var randPos = Math.floor(Math.random() * len);
                            callback(null, questions[randPos]);
                        }
                    });
                });
            }
        }
    );
};


exports.QuestionProvider = QuestionProvider;