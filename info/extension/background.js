import apiClient from "../src/axios.js";
//Listens for messages from contentscript.js
chrome.runtime.onMessage.addListener((request,sender,sendResponse)=>{
    if(request.action === 'openPopup'){
        chrome.action.openPopup();
        //optionally sending a response to the contentscript.js
        sendResponse({success: true, message: 'Popup opened from content script.'});
    }

    else if(request.action === "fetching cookie"){
        apiClient.post('/api/refresh',{withCredentials: true}).then((response)=>{sendResponse({success: true, data: response.data})}).catch((error)=>{sendResponse({success: false, error: error.message})});
        return true; //Indicate response will be sent asynchronously.
        console.log('notification to fetch cookie received.')
        //on the top we made a call to candidate(as a protected endpoint where it rewuires authenticaton)
        //responjse will hold CandidateCreate object.
    }
});


/*chrome.action.onClicked.addListener(async(tab) => {
    chrome.action.openPopup();
});*/
console.log("background js is accessed.")
/* comments 
    if(request.action === "jobApplicationDetected"){
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'images/icon.jpeg',
            title: 'job Application Detected!',
            message: 'Click the extension to autofill the form',


        },() =>{
            if(chrome.runtime.lastError){
                console.error('Notifications error',chrome.runtime.lastError);
                sendResponse({error: chrome.runtime.lastError.message})
            }
            else{
                sendResponse({success: true});
            }
        });
        return true; //indicate response will be sent asynchronously.
    } */