/**
 * Created with IntelliJ IDEA.
 * User: Ofer
 * Date: 12/06/13
 * Time: 10:56
 * To change this template use File | Settings | File Templates.
 */

QuestionProvider = require('../questionprovider').QuestionProvider;
var questionProvider= new QuestionProvider('localhost', 27017);


exports.submitQuestion = function(req, res){
    questionProvider.submitQuestion(req.session.user_id,{
                question_string: req.param('question_string'),
                required_answers: req.param('required_answers'),
                image_1: req.param('image_1'),
                image_2: req.param('image_2')
            }, function( error, question_id) {
                if(error) {
                    res.statusCode = 400;
                    res.send(error);
        } else {
            res.statusCode = 200;
            res.send("{\"question_id\": \"" + question_id + "\"}");
        }
    });
};


exports.getAllUserQuestions = function(req, res){
    questionProvider.getAllUserQuestions(req.session.user_id, function( error, questions_array) {
        if(error) {
            res.statusCode = 400;
            res.send(error);
        } else {
            res.statusCode = 200;
            res.send(JSON.stringify(questions_array));
        }
    });

};

exports.voteQuestion = function(req, res){
    questionProvider.voteQuestion(req.session.user_id,{
        question_id: req.param('question_id'),
        image_voted: req.param('image_voted')
    }, function(error) {
        if(error) {
            res.statusCode = 400;
            res.send(error);
        } else {
            res.send(200);
        }
    });
};



exports.getRandomQuestion = function(req, res){
    questionProvider.getRandomQuestion(req.session.user_id, function(error, question) {
        if(error) {
            res.statusCode = 400;
            res.send(error);
        } else {
            res.statusCode = 200;
            res.send(question);
        }
    });
};




exports.getQuestion = function(req, res){

};
