document.addEventListener('DOMContentLoaded',async() =>{
    const contentDiv = document.getElementById('content');
    try{
        const response = await new Promise((resolve)=>{
            chrome.runtime.sendMessage({action: 'fetching cookie'},resolve);
            console.log('notification to fetch cookie is sent from popup.js');

        });
        if(response && response.success && response.data){
            console.log('Extension finds the cookie:', response.data);
            contentDiv.innerHTML = `<button id ="autofillbutton">Autofill</button>`;
            const autofillbutton = document.getElementById('autofillbutton');
            if (autofillbutton){
                autofillbutton.addEventListener('click', async() =>{
                    try{
                        const tabs = await new Promise((resolve,reject)=>{
                            chrome.tabs.query({active:true,currentWindow: true}, (tabs)=>{
                                if(chrome.runtime.lastError || !tabs || !tabs.length){
                                    return reject("No active tab found.");
                                }
                                resolve(tabs);
                            });
    
                        });
                        const bundleURL = chrome.runtime.getURL('autofill.bundle.js');
                        console.log('bundleURL:',bundleURL);
                        //Use chrome scripting executescript with a funciton injection
                        await chrome.scripting.executeScript({
                            target: {tabId: tabs[0].id},
                            func: (url,token) =>{
                                const script = document.createElement('script');
                                script.type = 'module';
                                script.src = url;
                                script.onload = ()=>{
                                    import(url).then((module)=>{
                                        if(module && typeof module.autofillInit === 'function'){
                                            try{
                                                module.autofillInit(token);
                                            }
                                            catch(error){
                                                console.error('error while executing autofillInit:', error);
                                            }
                                        }
                                        else{
                                            console.error('Autofill Init export is not found.');
                                        }
                                    })
                                    .catch((err)=>{
                                        console.error('Error importing module:', err);
                                    });
                                  
                                };
                                script.onerror = () =>{
                                    console.error(`Failed to load script: ${url}`);
                                }
                                document.head.appendChild(script);
                            },
                            args: [bundleURL, response.data.access_token],
                        });
                    }
                    catch(error){
                        console.error(error);
                    }
                });
            }
            else{
                console.error('Autofill button element not found in popup.html');
            }
            //Future buttons
            //Autogenerate resume, cover letter,...
        }
        else{
            //No cookie or fetching failed, show login message.
            contentDiv.textContent = 'Please Login in the Main Web app';
            //Optionally add a link to the main app's loginpage
            const loginButton = document.createElement('button');
            loginButton.textContent = 'Login Here';
            loginButton.style.cursor = 'pointer';
            loginButton.onclick = () =>{
                window.location.href = 'http://localhost:3000';
            };
            contentDiv.appendChild(document.createTextNode(' '));
            contentDiv.appendChild(loginButton); //Append the button

        }

    }
    catch(error){
        console.error('Error communicating with background script:', error);
        contentDiv.textContext = ' Error checking Login status.';
    }
 


    
});
console.log('popup.js is accessed');










/*document.addEventListener('DOMContentLoaded', async() =>{
    const contentDiv = document.getElementById('content');
    //Retrieve the token from chrome.storage
    try{
        //Promisify chrome.storage.local.get
        const result = await new Promise((resolve,reject) =>{
            chrome.storage.local.get('authToken',(result) =>{
                if(chrome.runtime.lastError){
                    return reject(chrome.runtime.lastError);
                }
                resolve(result);
            });
        });
        const token = result.authToken;
        if(!token){
            contentDiv.textContent = "Please log in the web app"
        }
        else{
            contentDiv.innerHTML = `<button id ="autofillbutton">Autofill</button>`;
            const autofillbutton = document.getElementById('autofillbutton');
            if (autofillbutton){
                autofillbutton.addEventListener('click', async() =>{
                    try{
                        const tabs = await new Promise((resolve,reject)=>{
                            chrome.tabs.query({active:true,currentWindow: true}, (tabs)=>{
                                if(chrome.runtime.lastError || !tabs || !tabs.length){
                                    return reject("No active tab found.");
                                }
                                resolve(tabs);
                            });

                        });
                        const bundleURL = chrome.runtime.getURL('dist/autofill.bundle.js');
                        //Use chrome scripting executescript with a funciton injection
                        await chrome.scripting.executeScript({
                            target: {tabId: tabs[0].id},
                            func: (url,token) =>{
                                const script = document.createElement('script');
                                script.type = 'module';
                                script.src = url;
                                script.onload = ()=>{
                                    if(typeof window.autofillInit === 'function'){
                                        try{
                                            window.autofillInit(token);

                                        }
                                        catch(error){
                                            console.error('Error while executing autofillInit:', error);
                                        }
                                        
                                    }
                                    else{
                                        console.error('Autofill init func not found.')

                                    }
                                };
                                script.onerror = () =>{
                                    console.error(`Failed to load script: ${url}`);
                                }
                                document.head.appendChild(script);
                            },
                            args: [bundleURL, token],
                        });
                    }
                    catch(error){
                        console.error(error);
                    }
                });
            }
            else{
                console.error('Autofill button element not found in popup.html');
            }
        }

    }
    catch(error){
        console.error('Chrome storage error:', error);
        contentDiv.textContent = "Error accessing auth data.";
    }
});
console.log("popupjs is accessed.")
  if(typeof window.autofillInit === 'function'){
                                        try{
                                            window.autofillInit(token);
    
                                        }
                                        catch(error){
                                            console.error('Error while executing autofillInit:', error);
                                        }
                                        
                                    }
                                    else{
                                        console.error('Autofill init func not found.')
    
                                    }*/