document.addEventListener('DOMContentLoaded',async() =>{
    const contentDiv = document.getElementById('content');
    async function getStoredAutofillData(){
        return new Promise((resolve)=>{
            chrome.storage.local.get('autofillData',(result)=>{
                resolve(result.autofillData || null);
            });
        });
    }
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
                        const data = await getStoredAutofillData();
                        const bundleURL = chrome.runtime.getURL('autofill.bundle.js');
                        console.log('bundleURL:',bundleURL);
                        chrome.storage.local.get('autofillData',async(result)=>{})
                        //Use chrome scripting executescript with a funciton injection
                        await chrome.scripting.executeScript({
                            target: {tabId: tabs[0].id},
                            func: (url,token,data) =>{
                                /*if (document.getElementById('autofill-script')) {
                                    console.log('Autofill script already injected. Skipping...');
                                    return;
                                }*/
                                const script = document.createElement('script');
                                script.type = 'module';
                                script.src = url;
                                script.id = 'autofill-script';
                                script.onload = ()=>{
                                    import(url).then((module)=>{
                                        if(module && typeof module.autofillInit === 'function'){
                                            try{
                                                module.autofillInit(token, data);
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
                            args: [bundleURL, response.data.access_token, data],
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






