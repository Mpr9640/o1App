import React, {useState, useRef} from 'react';

const AudioPage = () =>{
    const [recording, setRecording] = useState(false);
    const [audioUrl, setAudioUrl] =useState(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([])

    const startRecording = async() =>{
        const stream = await navigator.mediaDevices.getUserMedia({audio: true});
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];

        mediaRecorderRef.current.ondataavailable = (event) =>{
            audioChunksRef.current.push(event.data);
        }
        mediaRecorderRef.current.onstop = () =>{
            const audioBlob = new Blob(audioChunksRef.current, {type:'audio/wav'});
            const url = URL.createObjectURL(audioBlob);
            setAudioUrl(url);
        };
         mediaRecorderRef.current.start();
         setRecording(true);
    };
    
    const stopRecording = () =>{
        mediaRecorderRef.current.stop();
        setRecording(false);
    };

    const handleUploadAudio = (event) =>{
        const file = event.target.files[0];
        if(file){
            alert('Uploaded: ${file.name}');
        }
    };

    return (
        <div className="audio">
            <h1>Record or Upload Audio</h1>
            <div>
                {!recording ? (<button onClick={startRecording}>Start Recording</button>) : (< button onClick={stopRecording}>Stop Recording</button>)}
            </div>
            <div>
                {audioUrl && <audio controls src={audioUrl}></audio>}
                <br/>
                <label htmlFor = "uploadaudio">
                    <input type="file" accept="audio/*" id="uploadaudio" onChange={handleUploadAudio}/>
                    <button>Upload Audio</button>
                </label>
            </div>

        </div>
    );
    
};

export default AudioPage;