User Activity Logging System

http://localhost:3000 - points to a simple front end. Each time the button is clicked or the form is submitted, it generates a console log on the server and confirms in the client console. Log events are added to an array in memory and to an events.log file. 
Every two minutes, the logs are summarized and a batch report is shown in the server console. It can be accessed from the client at http://localhost:3000/summary

The batch file and array are cleared for the next 2 minute interval.

