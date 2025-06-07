const jobApplicationKeywords = ['apply','job','career','application', 'profile', 'careers', 'jobs'];
//const formKeywords = ['name', 'resume','experience']
function isjobApplicationPage(){
    const url = window.location.href.toLowerCase()
    return jobApplicationKeywords.some(keyword =>url.includes(keyword));
}
let jobApplicationDetected = false;
const checkPage = async ()=>{
    if(isjobApplicationPage()){
        if(!jobApplicationDetected){
            console.log("job application detected, showing icon.");
            showIcon();
            jobApplicationDetected = true;
        }

    }
    else{
        removeIcon();
        //removeCustomPopup();
        //customPoupVisible = false;
        jobApplicationDetected = false; //reset the flag, if page is no longer a jobpage.
    }

   
}; 
function showIcon() {
    const iconUrl = chrome.runtime.getURL('images/icon.jpeg');
    const icon   = document.createElement('img');
    icon.src     = iconUrl;
    icon.id      = 'jobAidIcon';
  
    // initial CSS
    Object.assign(icon.style, {
      position:   'fixed',
      left:       '20px',
      top:        '20px',
      width:      '48px',
      height:     '48px',
      zIndex:     '10000',
      cursor:     'pointer',
      userSelect: 'none',
    });
  
    let isDragging = false;
    let moved      = false;
    let offsetX    = 0;
    let offsetY    = 0;
  
    // Start drag on pointerdown
    icon.addEventListener('pointerdown', e => {
      isDragging = true;
      moved      = false;
      offsetX    = e.clientX - icon.offsetLeft;
      offsetY    = e.clientY - icon.offsetTop;
      icon.setPointerCapture(e.pointerId);
      icon.style.cursor = 'grabbing';
      // prevent text‑selection / image drag
      e.preventDefault();
    });
  
    // Move on pointermove
    icon.addEventListener('pointermove', e => {
      if (!isDragging) return;
      moved = true;
      //compute raw positions
      x= e.clientX - offsetX;
      y= e.clientY - offsetY;
    // clamp to [0, viewport-iconSize]
      const maxX=window.innerWidth - icon.offsetWidth;
      const maxY = window.innerHeight-icon.offsetHeight;

      x=Math.max(0,Math.min(x,maxX));
      y=Math.max(0,Math.min(y,maxY));

      icon.style.left = x + 'px';
      icon.style.top = y + 'px';

    });
  
    // End drag on pointerup (auto‑drops)
    icon.addEventListener('pointerup', e => {
      if (!isDragging) return;
      isDragging = false;
      icon.releasePointerCapture(e.pointerId);
      icon.style.cursor = 'pointer';
    });
  
    // Click handler: only fire if no drag occurred
    icon.addEventListener('click', e => {
      if (moved) {
        // suppress any click after a drag
        e.stopImmediatePropagation();
        return;
      }
      chrome.runtime.sendMessage({ action: 'openPopup' });
    });
  
    document.body.appendChild(icon);
  }
  
function removeIcon(){
    const icon = document.getElementById('jobAidIcon');
    if(icon){
        icon.remove();
    }
 
    //if(existing) existing.remove();
}
checkPage();
//document.addEventListener(DOMContentLoaded,checkPage); //checking the page on initial load

//Optionally checking periodically if the URl changes without a full relaod
setInterval(checkPage, 5000);

