10 REM Oopis Basic Showcase
20 PRINT "Hello from Oopis Basic!"
30 PRINT ""
40 PRINT "Let's list the files in the current directory..."
50 LET DIR_LIST$ = SYS_CMD("ls -l")
60 PRINT DIR_LIST$
70 PRINT ""
80 PRINT "Now, what is your name? "; INPUT NAME$
100 LET GREETING$ = "Welcome to OopisOS, " + NAME$ + "!"
110 PRINT GREETING$
120 PRINT "I'll save this greeting to 'welcome.txt' for you."
130 SYS_WRITE("welcome.txt", GREETING$)
140 PRINT "Done."
150 PRINT ""
160 PRINT "Do you want to read it back? (Y/N) ";
170 INPUT CONFIRM$
180 IF CONFIRM$ = "Y" THEN GOTO 200
190 GOTO 220
200 LET FILE_CONTENT$ = SYS_READ("welcome.txt")
210 PRINT "File 'welcome.txt' contains: " + FILE_CONTENT$
220 PRINT ""
230 PRINT "Goodbye!"