// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ActivityHandler, MessageFactory } = require('botbuilder');

const { QnAMaker } = require('botbuilder-ai');
const DentistScheduler = require('./dentistscheduler');
const IntentRecognizer = require('./intentrecognizer');


class DentaBot extends ActivityHandler {
    constructor(configuration, qnaOptions) {
        // call the parent constructor
        super();
        if (!configuration) throw new Error('[QnaMakerBot]: Missing parameter. configuration is required');

        // create a QnAMaker connector
        this.QnAMaker = new QnAMaker(configuration.QnAConfiguration, qnaOptions);
       
        // create a DentistScheduler connector
        this.DentistScheduler = new DentistScheduler(configuration.SchedulerConfiguration);
      
        // create a IntentRecognizer connector
        this.IntentRecognizer =  new IntentRecognizer(configuration.LuisConfiguration);


        this.onMessage(async (context, next) => {
            try{
                // send user input to QnaMaker and collect the response in a variable
                const qnaResults = await this.QnAMaker.getAnswers(context);
                // send user input to IntentRecognizer and collect the response in a variable
                // don't forget 'await'
                const LuisResult =  await this.IntentRecognizer.executeLuisQuery(context);    
                // top intent from LUIS
                const topIntent =LuisResult.luisResult.prediction.topIntent;  
                const intentScore = LuisResult.intents[topIntent].score;

                let replyMessage;
                if(intentScore >= 0.65){
                    if(topIntent === "getAvailability"){
                        replyMessage = await this.DentistScheduler.getAvailability(this.IntentRecognizer.getTimeEntity(LuisResult));
                    }else{
                        replyMessage =  await this.DentistScheduler.scheduleAppointment(this.IntentRecognizer.getTimeEntity(LuisResult), this.IntentRecognizer.getDateEntity(LuisResult));
                    }
                }else{
                    replyMessage = qnaResults[0].answer;
                }
                    
                await context.sendActivity(MessageFactory.text(replyMessage, replyMessage));
            }catch(e){
                console.error(e);
            }
             
            await next();
        
        });

        this.onMembersAdded(async (context, next) => {
        const membersAdded = context.activity.membersAdded;
        //write a custom greeting
        const welcomeText = 'Welcome to Dental Office Virtual Assistant. I can help you to schedule your dental appointment '
                            + 'or help you to find the next available appointment times.  '
                            + 'You can say "schedule an appointment today at 3pm" '
                            + 'or "are you open on weekend?"';

        for (let cnt = 0; cnt < membersAdded.length; ++cnt) {
            if (membersAdded[cnt].id !== context.activity.recipient.id) {
                await context.sendActivity(MessageFactory.text(welcomeText, welcomeText));
            }
        }
        // by calling next() you ensure that the next BotHandler is run.
        await next();
    });
    }
}

module.exports.DentaBot = DentaBot;

