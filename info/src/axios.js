//Axios interceptor
import axios from 'axios';

//creating an axios instance
const createApiClient = () =>{
    const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
    return axios.create({
        baseURL: API_BASE_URL,
        withCredentials: true, //including cookies
    });
    

}
const apiClient =  createApiClient();
//Adding a response interceptor
apiClient.interceptors.response.use(
    (response)=>{
        //pass through successful responses
        return response;
    },
    async (error) =>{
        const originalRequest = error.config;
        if(error.response?.status === 401 && !originalRequest._retry){
            originalRequest._retry = true;
            try{
                //call the /refresh endpoint to get a new token
                const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
                const refreshResponse = await axios.post(`${API_BASE_URL}/api/refresh`, {},{withCredentials: true});
                if(refreshResponse.status === 200){
                    console.log('Token refreshed succesfully');
                    //Extrace the new access token from refresh response
                    const newAccessToken = refreshResponse.data.access_token;
                    //Extrace the original requests authorization header
                    originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
                    //Retry the original request with the new token
                    return apiClient(originalRequest);
                }
            }
            catch(refreshError){
                console.error('Failed to refresh token. please log in again.');
                //Optionally redirect to login 
                window.location.href =  "/login";
                return Promise.reject(refreshError);
            }
        }
        //Reject the promise, if the error is not handled here.
        return Promise.reject (error);

    }



);
export default  apiClient;