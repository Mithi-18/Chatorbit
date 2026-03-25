const fs = require('fs');
const files = [
  'client/src/views/AuthView.jsx',
  'client/src/views/ChatView.jsx',
  'client/src/views/HomeView.jsx',
  'client/src/lib/socket.js',
  'client/src/components/ChatInput.jsx'
];

files.forEach(f => {
  let text = fs.readFileSync(f, 'utf8');
  text = text.replace(/'http:\/\/localhost:5000([^']*)'/g, "`\\${import.meta.env.VITE_API_URL || 'http://localhost:5000'}$1`");
  text = text.replace(/`http:\/\/localhost:5000([^`]*)`/g, "`\\${import.meta.env.VITE_API_URL || 'http://localhost:5000'}$1`");
  fs.writeFileSync(f, text);
});
console.log('URLs updated successfully.');
