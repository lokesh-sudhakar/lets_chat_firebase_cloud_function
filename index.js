const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config.functions);
var db = admin.firestore();
db.settings({"ignoreUndefinedProperties":true})
var newData;

exports.updateUnreadMsg = functions.firestore.document('ChatRoom/{chatRoomId}/user/{userId}')
        .onUpdate(async (snapshot,context)=>{
            if (snapshot.empty){
                console.log('No Devices');
                return;
            }
            const chatRoomIdText = context.params.chatRoomId;
            const userId = context.params.userId
            const chatReceiverMetaData = await db
                .collection("ChatRoom").doc(chatRoomIdText)
                .collection("user").doc(userId).get();
            /*
                clear unread message when user is online
            */
            if (chatReceiverMetaData.data().active) {
                updateData = {["unreadMessages"]: 0};
                await db
                    .collection("ChatRoom").doc(chatRoomIdText)
                    .collection("user").doc(userId)
                    .update(updateData).catch((err)=>{
                        console.log(err.message);
                    })
            }
        });


exports.messageTrigger = functions.firestore.document('ChatRoom/{chatRoomId}/chats/{chatId}')
        .onCreate(async (snapshot,context)=>{
            if (snapshot.empty) {
                console.log('No Devices');
                return;
            }
            var batch = db.batch();
            // console.log("chat room id -> ", context.params.chatRoomId);
            const chatRoomIdText = context.params.chatRoomId;
            var messageText = snapshot.data().message;
            var sentBy = snapshot.data().sentBy;
            var time = snapshot.data().time;
            var sentByUser = snapshot.data().sentByUser;
            console.log("message -> "+ messageText);
            console.log("sentBy -> "+ sentBy);
            console.log("sent time -> "+time);
            console.log("chat room id -> "+chatRoomIdText);

             /*
                updating last message and the time of message
            */    
        
           console.log('Sent time '+ time);
           console.log('lastmessage '+messageText);
            var updateLastMessage  = {["lastMessage"]: messageText,["lastMessageTime"]:time};
            // var doc = 
            await db
                .collection("ChatRoom").doc(chatRoomIdText)
                .update(updateLastMessage, {merge: true}).catch((err)=>{
                    console.log(err.message);
                });
            
            /**
             * to get receiver username
             */
            var chatRoomUsers = await admin.firestore()
                .collection("ChatRoom").doc(chatRoomIdText).get();
            var isGroupChat = chatRoomUsers.data().isGroupChat;
            var groupName = chatRoomUsers.data().groupName;
            var chatRoomUserList = chatRoomUsers.data().users;
            var receiverUserNumber = chatRoomUserList.filter(e => e !== sentBy);
            // chatRoomUserList.splice(chatRoomUserList.indexOf(sentBy),1);
            console.log("received by -> "+ receiverUserNumber.length);
            // var receiverUserNumber = chatRoomUserList;

            /**
             * to increment users unread messages
             */

            for ( index in receiverUserNumber) {
                  /* eslint-disable no-await-in-loop */
                console.log("receiver -> "+ receiverUserNumber[index]);
                var chatReceiverMetaData = await db
                .collection("ChatRoom").doc(chatRoomIdText)
                .collection("user").doc(receiverUserNumber[index]).get();
                console.log("received by -> "+ chatReceiverMetaData.data());
                var  updateData;
                if (!chatReceiverMetaData.data().active) {
                    var unreadMessageCount = chatReceiverMetaData.data().unreadMessages;
                    updateData = {["unreadMessages"]: unreadMessageCount+1};
                    console.log("unread msg count -> "+ unreadMessageCount);
                    await db.collection("ChatRoom").doc(chatRoomIdText)
                            .collection("user").doc(receiverUserNumber[index])
                            .update(updateData).catch((err)=>{
                                console.log(err.message);
                            })
                }
                  /* eslint-disable no-await-in-loop */

            }
            
            const deviceTokens = await db
                .collection("users")
                .where("phoneNumber","in",receiverUserNumber)
                .get();
            
            // console.log("token -> "+ deviceTokens.docs.length);
            var tokens = [];
            // deviceTokens.doc.forEach(element => {
            //     tokens.add(deviceTokens.doc[index].data.firebase_token);
            // });
            for(index in deviceTokens.docs) {
                console.log("token -> "+ deviceTokens.docs[index].data().firebase_token);
                tokens.push(deviceTokens.docs[index].data().firebase_token);
            }

            // var tokens = [deviceTokens.docs[0].data().firebase_token];
            var payLoad
            if (isGroupChat) {
                payLoad = {
                    "notification": {"title": groupName, "body": messageText,"sound": "default"}, 
                    "data": {"click_action": "FLUTTER_NOTIFICATION_CLICK", "message": messageText}
                }
            } else {
                payLoad = {
                    "notification": {"title": sentByUser, "body": messageText,"sound": "default"}, 
                    "data": {"click_action": "FLUTTER_NOTIFICATION_CLICK", "message": messageText}
                }
            }
            try {
                const response = await admin.messaging().sendToDevice(tokens,payLoad);
                console.log("Notification sent successfully");
            } catch (err) {
                console.log(err.message);
            }
            // batch.commit();
        });