# WebRTC Video Call Application

A real-time video calling application built with Go, WebRTC, and Next.js.

## Features

- Video and audio calling with multiple participants
- Host-based room management
- Real-time participant status updates
- Responsive design for desktop and mobile
- Low-latency peer-to-peer communication
- Secure WebRTC connections

## Local Development

### Backend (Go)

1. Make sure you have Go installed (1.16+)
2. Clone the repository
3. Run the backend server:

```bash
go run main.go
```

The server will start on port 8080.

### Frontend (Next.js)

1. Navigate to the frontend directory
2. Install dependencies:

```bash
cd frontend
npm install
```

3. Start the development server:

```bash
npm run dev
```

The Next.js app will start on port 3000.

4. Open your browser to http://localhost:3000 to use the application

## Deployment

### Using Docker

The easiest way to deploy is using Docker:

1. Build the Docker image:

```bash
docker build -t webrtc-video-app .
```

2. Run the container:

```bash
docker run -p 8080:8080 -p 3000:3000 webrtc-video-app
```

### Manual Deployment

#### Backend

1. Build the Go binary:

```bash
go build -o webrtc-server
```

2. Run the server:

```bash
./webrtc-server
```

#### Frontend

1. Update the `.env.local` file with your server's address:

```
NEXT_PUBLIC_API_URL=your-server-address.com
```

2. Build the Next.js application:

```bash
cd frontend
npm run build
```

3. Start the Next.js server:

```bash
npm start
```

### Cloud Deployment

For cloud deployment (AWS, GCP, Azure, etc.):

1. Deploy the Go backend as a service
2. Configure proper ports and firewall rules (8080 for the backend)
3. Deploy the Next.js frontend to a CDN or serverless platform
4. Set the proper environment variables

## Sharing with Friends

To share a video call with friends:

1. Create a room as a host
2. Share the URL that appears in your browser with your friends
3. They can click the link to join your room
4. Everyone must grant camera and microphone permissions to participate

## License

MIT

## Support

For issues or questions, please open an issue on GitHub.
