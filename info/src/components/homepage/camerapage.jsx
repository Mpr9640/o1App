import React, {useRef, useState} from 'react';

const CameraPage = () =>{
    const videoRef = useRef(null);
    const [photo, setPhtoto]= useState(null);
    const [recording, setRecording] = useState(null);
    const [videoUrl, setVideoUrl] = useState(null);
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const [videoChunks, setVideoChunks] = useState(null);

    //Start the camera and show live feed
    const startCamera = async()=>{
        try{
            const stream = await navigator.mediaDevices.getUserMedia({video: true})
            videoRef.current.srcObject = stream;
        }
        catch(error){
            console.error('Error accessing the camera', error);
            alert('Unable to access the camera.');
        }
    };

    // Capturing a photo from video feed.
    const capturePhoto=()=>{
        const video = videoRef.current;
        if(!video) return;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0,0,canvas.width,canvas.heigth);
        const imageDataUrl = canvas.toDataURL('image/png');
        setPhtoto(imageDataUrl);
    };

    // start video recording using media recorder

    const startRecording=()=>{
        const stream = videoRef.current.srcobject;
        if(!stream){
            alert('Please start the camera first.');
            return;
        }
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm'});
        setMediaRecorder(recorder);
        let chunks = [];
        recorder.ondataavailable = event=>{
            if(event.data && event.data.size >0){
                chunks.push(event.data);
            }
        };
        recorder.onStop = () =>{
            const blob = new Blob(chunks, { type: 'video/webm'});
            const url = URL.createObjectURL(blob);
            setVideoUrl(url);
            setVideoChunks([]);
        };
        recorder.start();
        setVideoChunks(chunks);
        setRecording(true);
    };


    // stop video recording
    const stopRecording = () =>{
        if(mediaRecorder){
            mediaRecorder.stop();
            setRecording(false);
        }
    };

    const handlePhotoUpload=(e)=>{
        const file = e.target.files[0];
        if(file){
            //optionally, convert the file into a data URL for preview
            const reader = new FileReader();
            reader.onload = (event)=>{
                setPhtoto(event.target.result);
            };
            reader.readAsDataURL(file);
        }
    };

    return(
        <div className = 'camerapage'>
            <h1>Camera Page </h1>
            <video ref = {videoRef} autoPlay playsInline></video>
            <div className="sncbutton">

                <button onClick = {startCamera}>Start Camera</button>
                <button onClick = {capturePhoto}>Capture Photo</button>


            </div>
            <div className='sncbutton'>
                {!recording ? (<button onClick={startRecording}>Start video recording</button>) : (<button onClick={stopRecording}>Stop Video recording</button>)}
            </div>
            <div className='sncbutton'>
                <label htmlFor="uploadphoto">
                    <input type = "file" accept="image/*" id="uploadphoto" onChange={handlePhotoUpload}/>
                    <button>Upload Photo</button>
                </label>
                
            </div>
            {
                photo && ( <div> <h3>Captured/Uploaded Photo:</h3><img src={photo} alt="Captured"/></div>)

            }
            {
                videoUrl && (<div><h3>Recorded Video:</h3><video src={videoUrl}/></div>)
            }


            
        </div>
    )
}
        
export default CameraPage;




