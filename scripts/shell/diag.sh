echo "===== OopisOS Core Test Suite v5.1 Initializing ====="
echo "This script tests all non-interactive core functionality, now with maximum paranoia."
delay 200

echo "---------------------------------------------------------------------"
echo ""
echo "--- Phase 1: Setting up test users/groups ---"

# Create all users and groups needed for the entire test run at the beginning.
# The 'run' command will correctly pipe the next two lines as password and confirmation.
echo "Creating users: diagUser, testuser, sudouser, limitedsudo..."
useradd diagUser
testpass
testpass
useradd testuser
testpass
testpass
useradd sudouser
testpass
testpass
useradd limitedsudo
testpass
testpass
useradd paradoxuser
testpass
testpass
useradd comm_user1
testpass
testpass
useradd comm_user2
testpass
testpass
useradd sudouser2
testpass
testpass
useradd recursive_test_user
testpass
testpass

echo "Creating groups: testgroup, recursive_test_group, harvest_festival..."
groupadd testgroup
groupadd recursive_test_group
delay 200

echo "Setting up primary diagnostic workspace..."
mkdir -p /home/diagUser/diag_workspace/
# The owner is the diagnostic user
chown diagUser /home/diagUser/diag_workspace/
# The group must be 'testgroup' so 'testuser' can enter
chgrp testgroup /home/diagUser/diag_workspace/
# Permissions allow owner (diagUser) and group (testgroup) full access
chmod 770 /home/diagUser/diag_workspace/
# Permissions on the parent directory must allow others to pass through
chmod 755 /home/diagUser

echo "sudouser ALL" >> /etc/sudoers
echo "sudouser2 ls" >> /etc/sudoers
echo "Setup complete."
echo "---------------------------------------------------------------------"
echo ""

echo ""
echo "--- Phase 2: Creating diagnostic assets ---"
echo "Creating basic FS assets..."
mkdir -p src mv_test_dir overwrite_dir find_test/subdir zip_test/nested_dir "a dir with spaces"
mkdir -p recursive_test/level2/level3
echo  "Inflating text/diff assets..."
echo -e "line one\nline two\nline three" > diff_a.txt
echo -e "line one\nline 2\nline three" > diff_b.txt
delay 200
echo "Building permissions assets..."
echo "I should not be executable" > exec_test.sh; chmod 600 exec_test.sh
touch preserve_perms.txt; chmod 700 preserve_perms.txt
echo "Dispensing data processing assets..."
delay 200
echo -e "zeta\nalpha\nbeta\nalpha\n10\n2" > sort_test.txt
echo "The quick brown fox." > text_file.txt
echo -e "apple\nbanana\napple\napple\norange\nbanana" > uniq_test.txt
echo -e "id,value,status\n1,150,active\n2,80,inactive\n3,200,active" > awk_test.csv
echo "Generating xargs assets..."
delay 200
echo "Finding assets..."
touch find_test/a.txt find_test/b.tmp find_test/subdir/c.tmp
chmod 777 find_test/a.txt
delay 200
echo "Zipping assets..."
echo "file one content" > zip_test/file1.txt
echo "nested file content" > zip_test/nested_dir/file2.txt
delay 200
echo "Scripting assets..."
echo '#!/bin/oopis_shell' > /home/root/arg_test.sh
echo 'echo "Arg 1: $1, Arg 2: $2, Arg Count: $#, All Args: $@" ' >> /home/root/arg_test.sh
chmod 777 /home/root/arg_test.sh
delay 200
echo "Sorting assets..."
touch -d "2 days ago" old.ext
touch -d "1 day ago" new.txt
echo "short" > small.log
echo "this is a very long line" > large.log
delay 200
echo "Assembling recursive test assets..."
echo "I am a secret" > recursive_test/secret.txt
echo "I am a deeper secret" > recursive_test/level2/level3/deep_secret.txt
delay 200
echo "Electing state management assets..."
echo "Original State" > state_test.txt
echo "Asset creation complete."
delay 200
echo "---------------------------------------------------------------------"

echo ""
echo "===== Phase 3: Testing Core FS Commands (Expanded) ====="
delay 200
echo "--- Test: diff, cp -p, mv ---"
diff diff_a.txt diff_b.txt
cp -p preserve_perms.txt preserve_copy.sh
echo "Verifying preserved permissions:"
ls -l preserve_perms.txt preserve_copy.sh
mv exec_test.sh mv_test_dir/
ls mv_test_dir/
delay 200
echo "--- Test: rename (file and directory) ---"
echo "rename test file" > old_name.txt
rename old_name.txt new_name.txt
echo "Verifying file rename:"
ls new_name.txt
check_fail "ls old_name.txt"
mkdir old_dir
rename old_dir new_dir
echo "Verifying directory rename:"
ls -d new_dir/
check_fail "ls -d old_dir"
delay 200
echo "--- Test: rename failure conditions ---"
echo "another file" > another_file.txt
check_fail "rename new_name.txt another_file.txt"
check_fail "rename new_name.txt mv_test_dir/another_location.txt"
rm -r new_name.txt another_file.txt new_dir
echo "Rename tests complete."
delay 400
echo "--- Test: touch -d and -t ---"
touch -d "1 day ago" old_file.txt
touch -t 202305201200.30 specific_time.txt
ls -l old_file.txt specific_time.txt
echo "--- Test: ls sorting flags (-t, -S, -X, -r) ---"
echo "Sorting by modification time (newest first):"
ls -lt
echo "Sorting by size (largest first):"
ls -lS
delay 200
echo "Sorting by extension:"
ls -lX
delay 200
echo "Sorting by name in reverse order:"
ls -lr
echo "--- Test: cat -n ---"
cat -n diff_a.txt
delay 500
echo "--- Test: cd into a file (should fail) ---"
echo "this is a file" > not_a_directory.txt
delay 200
check_fail "cd not_a_directory.txt"
delay 200
rm not_a_directory.txt
echo "---------------------------------------------------------------------"

echo ""
echo "===== Phase 4: Testing Group Permissions & Ownership (Expanded) ====="
delay 200
usermod -aG testgroup testuser
groups testuser
mkdir -p /tmp/no_exec_dir
chmod 644 /tmp/no_exec_dir
chmod 755 /home/diagUser
cd /home/diagUser/diag_workspace
delay 200
echo "Initial content" > group_test_file.txt
chown diagUser group_test_file.txt
chgrp testgroup group_test_file.txt
chmod 664 group_test_file.txt
echo "--- Test: Group write permission ---"
su testuser testpass
cd /home/diagUser/diag_workspace
delay 200
echo "Append by group member" >> group_test_file.txt
cat group_test_file.txt
echo "--- Test: 'Other' permissions (should fail) ---"
logout
su Guest
check_fail "echo 'Append by other user' >> /home/diagUser/diag_workspace/group_test_file.txt"
delay 200
echo "--- Test: Permission Edge Cases ---"
logout
su testuser testpass
check_fail "chmod 777 /home/diagUser/diag_workspace/group_test_file.txt"
check_fail "cd /tmp/no_exec_dir"
delay 200
logout
delay 200
su diagUser testpass
delay 200
cd /home/diagUser/diag_workspace
delay 500
echo "---------------------------------------------------------------------"

echo ""
echo "===== Phase 4.5: Testing Recursive Ownership & Group Permissions ====="
delay 200
logout
mkdir -p /home/Guest/recursive_chown_test/subdir
echo "level 1 file" > /home/Guest/recursive_chown_test/file1.txt
echo "level 2 file" > /home/Guest/recursive_chown_test/subdir/file2.txt
echo "Initial state:"
ls -lR /home/Guest/recursive_chown_test
delay 400

echo "--- Test: Recursive chown (-R) ---"
chown -R recursive_test_user /home/Guest/recursive_chown_test
echo "State after recursive chown:"
ls -lR /home/Guest/recursive_chown_test
delay 400

echo "--- Test: Recursive chgrp (-R) ---"
chgrp -R recursive_test_group /home/Guest/recursive_chown_test
echo "State after recursive chgrp:"
ls -lR /home/Guest/recursive_chown_test
delay 400
echo "Recursive ownership tests complete."
delay 400
echo "---------------------------------------------------------------------"
echo ""
echo "===== Phase 5: Testing High-Level Committee Command ====="
delay 200
echo "--- Executing committee command ---"
committee --create harvest_festival --members comm_user1,comm_user2
delay 400
echo "--- Verifying results ---"
echo "Checking group memberships:"
groups comm_user1
groups comm_user2
echo "Checking directory and permissions (should be drwxrwx--- ... harvest_festival):"
ls -l /home/ | grep "project_harvest_festival"
delay 400
echo "--- Test: Member write access (should succeed) ---"
logout
su comm_user1 testpass
echo "I solemnly swear to bring a pie." > /home/project_harvest_festival/plan.txt
cat /home/project_harvest_festival/plan.txt
delay 400
echo "--- Test: Non-member access (should fail) ---"
su Guest
check_fail "ls /home/project_harvest_festival"
check_fail "cat /home/project_harvest_festival/plan.txt"
delay 400
echo "Committee command test complete."
delay 400
echo "---------------------------------------------------------------------"

echo ""
echo "===== Phase 6: Testing Sudo & Security Model ====="
delay 200
logout
su sudouser testpass
echo "Attempting first sudo command (password required)..."
sudo echo "Sudo command successful."
testpass
delay 200
echo "Attempting second sudo command (should not require password)..."
sudo ls /home/root
logout
su Guest
check_fail "sudo ls /home/root"

echo "--- Test: Granular sudo permissions ---"
logout
su sudouser2 testpass
echo "Attempting allowed specific command (ls)..."
sudo ls /home/root
testpass
delay 200
echo "Attempting disallowed specific command (rm)..."
check_fail "sudo rm -f /home/Guest/README.md"
logout
su diagUser testpass
cd /home/diagUser/diag_workspace
echo "Granular sudo test complete."
delay 400
echo "---------------------------------------------------------------------"

echo ""
echo "===== Phase 7: Testing Scripting & Process Management ====="
delay 200
logout
cd /home/root
echo "--- Test: Script argument passing ---"
run ./arg_test.sh first "second arg" third
echo "--- Test: Background jobs (ps, kill) ---"
delay 5000 &
ps
ps | grep delay | awk '{print $1}' | xargs kill
ps
delay 400
echo "---------------------------------------------------------------------"

echo ""
echo "===== Phase 8: Testing Data Processing & Text Utilities ======="
delay 200
echo "--- Test: sort (-n, -r, -u) ---"
sort -r sort_test.txt
sort -n sort_test.txt
sort -u sort_test.txt
delay 400
echo "--- Test: wc (-l, -w, -c) ---"
wc text_file.txt
wc -l -w -c text_file.txt
echo "--- Test: head/tail (-n, -c) ---"
head -n 1 text_file.txt
tail -c 5 text_file.txt
delay 400
echo "--- Test: grep flags (-i, -v, -c) ---"
grep -i "FOX" text_file.txt
grep -c "quick" text_file.txt
grep -v "cat" text_file.txt
echo "--- Test: xargs and pipe awareness ---"
logout
su diagUser testpass
cd /home/diagUser/diag_workspace
rm -f file1.tmp file2.tmp file3.tmp
touch file1.tmp file2.tmp file3.tmp
ls -1 *.tmp | xargs rm
check_fail "ls file1.tmp"
echo "xargs deletion verified."
delay 400
echo "---------------------------------------------------------------------"

echo ""
echo "===== Phase 9: Testing 'find' and Archival (zip/unzip) ====="
delay 200
echo "--- Test: find by name, type, and permissions ---"
logout
cd /
mkdir -p find_test/subdir
touch find_test/a.txt find_test/b.tmp find_test/subdir/c.tmp
chmod 777 find_test/a.txt
find find_test -name "*.tmp"
find find_test -type d
find find_test -perm 777
delay 400
echo "--- Test: zip/unzip ---"
mkdir -p zip_test/nested_dir
echo "file one content" > zip_test/file1.txt
echo "nested file content" > zip_test/nested_dir/file2.txt
zip my_archive.zip ./zip_test
rm -r -f zip_test
unzip my_archive.zip .
ls -R zip_test
delay 400
echo "---------------------------------------------------------------------"

echo ""
echo "===== Phase 10: Testing Pager and Calculator Tests ====="
delay 200
echo "--- Test: bc command (pipe and argument) ---"
echo "5 * (10 - 2) / 4" | bc
bc "100 + 1"
check_fail "bc '5 / 0'"
delay 400
echo "--- Test: Pager integration (non-interactive pipe-through) ---"
echo -e "Line 1\nLine 2\nLine 3" > pager_test.txt
cat pager_test.txt | more | wc -l
cat pager_test.txt | less | wc -l
echo "Pager pass-through test complete."
echo "--- Test: Input Redirection (<) ---"
echo "hello redirect" > input_redir.txt
cat < input_redir.txt
delay 400
rm pager_test.txt input_redir.txt
echo "Input redirection test complete."
delay 200
echo "--- Test: expr command ---"
expr 2000 + $(date | awk '{print $4}' | cut -c 3-4)
delay 200
echo "Expression test complete."
delay 400
echo "---------------------------------------------------------------------"

echo ""
echo "===== Phase 11: Testing Data Transformation & Integrity Commands ====="
delay 200
echo "--- Test: rmdir ---"
mkdir empty_dir
rmdir empty_dir
check_fail "ls empty_dir"
mkdir non_empty_dir; touch non_empty_dir/file.txt
check_fail "rmdir non_empty_dir"
rm -r non_empty_dir
echo "rmdir tests complete."
delay 200
echo "--- Test: base64 (encode/decode) ---"
echo "The Tao is eternal." > b64_test.txt
base64 b64_test.txt > b64_encoded.txt
base64 -d b64_encoded.txt
rm b64_test.txt b64_encoded.txt
echo "base64 tests complete."
delay 200
echo "--- Test: xor (encrypt/decrypt) ---"
echo "Harmony and order." > xor_test.txt
xor diag_pass xor_test.txt > xor_encrypted.txt
xor diag_pass xor_encrypted.txt
rm xor_test.txt xor_encrypted.txt
echo "xor tests complete."
delay 200
echo "--- Test: ocrypt (secure encrypt/decrypt) ---"
echo "A truly secure message." > ocrypt_test.txt
ocrypt diag_secure_pass ocrypt_test.txt
ocrypt -d diag_secure_pass ocrypt_test.txt | grep "A truly secure message."
rm ocrypt_test.txt
echo "ocrypt secure tests complete."
delay 200
echo "--- Test: cksum and sync ---"
echo "A well-written program is its own Heaven." > cksum_test.txt
cksum cksum_test.txt
sync
delay 400
echo "A poorly-written program is its own Hell." >> cksum_test.txt
cksum cksum_test.txt
rm cksum_test.txt
echo "cksum and sync tests complete."
delay 200
# --- Test: csplit ---
echo -e "alpha\n" > csplit_test.txt
echo -e "bravo\n" >> csplit_test.txt
echo -e "charlie\n" >> csplit_test.txt
echo -e "delta\n" >> csplit_test.txt
echo -e "echo" >> csplit_test.txt
delay 400
csplit csplit_test.txt 3
ls xx*
rm -f xx00 xx01 csplit_test.txt
echo "csplit test complete."
delay 400
echo "---------------------------------------------------------------------"

echo ""
echo "===== Phase 12: Testing Underrepresented Commands (Data/System) ====="
delay 200
echo "--- Test: uniq (-d, -u) ---"
echo -e "apple\nbanana\napple\napple\norange\nbanana" > uniq_test.txt
sort uniq_test.txt | uniq -d
sort uniq_test.txt | uniq -u
echo "--- Test: awk scripting ---"
echo "Printing active users with values over 100 from csv"
echo -e "id,value,status\n1,150,active\n2,80,inactive\n3,200,active" > awk_test.csv
awk -F, '/,active/ { print "User " $1 " is " $3 }' awk_test.csv
echo "--- Test: shuf (-i, -e) ---"
shuf -i 1-5 -n 3
shuf -e one two three four five
delay 400
echo "--- Test: tree (-L, -d) ---"
mkdir -p recursive_test/level2/level3
echo "I am a secret" > recursive_test/secret.txt
echo "I am a deeper secret" > recursive_test/level2/level3/deep_secret.txt
tree -L 2 ./recursive_test
tree -d ./recursive_test
echo "--- Test: du (recursive) and grep (-R) ---"
du recursive_test/
grep -R "secret" recursive_test/
echo "Underrepresented data command tests complete."
delay 400
echo "---------------------------------------------------------------------"

echo ""
echo "===== Phase 13: Testing Shell & Session Commands ====="
delay 200
echo "--- Test: date ---"
date
echo "--- Test: df -h ---"
df -h
echo "--- Test: du -s ---"
du -s .
echo "--- Test: history -c ---"
history
history -c
history
delay 400
echo "--- Test: alias/unalias ---"
alias myls="ls -l"
myls
unalias myls
check_fail "myls"
echo "--- Test: set/unset ---"
set MY_VAR="Variable Test Passed"
echo $MY_VAR
unset MY_VAR
echo $MY_VAR
echo "--- Test: printscreen ---"
printscreen screen.txt
cat screen.txt
delay 200
echo "---------------------------------------------------------------------"

echo ""
echo "===== Phase 14: Testing Network & System Documentation Commands ====="
delay 200
echo "--- Test: wget and curl ---"
wget -O wget.txt https://raw.githubusercontent.com/aedmark/Oopis-OS/refs/heads/master/docs/LICENSE.txt
cat wget.txt
rm wget.txt
curl https://raw.githubusercontent.com/aedmark/Oopis-OS/refs/heads/master/docs/LICENSE.txt > oopis_curl.txt
cat oopis_curl.txt
rm oopis_curl.txt
echo "--- Test: ping - Pinging a known-good host ---"
ping raw.githubusercontent.com
delay 400
echo "--- Test: ping - Pinging a non-existent host (should fail gracefully) ---"
check_fail "ping a-domain-that-does-not-exist-and-never-will.invalid"
delay 400
echo "'ping' command diagnostics finished."
echo "---------------------------------------------------------------------"
echo "--- Test: man and help ---"
man ls
help cp
echo "Network & Docs tests complete."
delay 400
echo "---------------------------------------------------------------------"

echo ""
echo "===== Phase 15: Testing Edge Cases & Complex Scenarios (Expanded) ====="
delay 200

echo "--- Test: Filenames with spaces ---"
mkdir "my test dir"
echo "hello space" > "my test dir/file with spaces.txt"
ls "my test dir"
cat "my test dir/file with spaces.txt"
mv "my test dir" "your test dir"
ls "your test dir"
rm -r "your test dir"
delay 200
check_fail "ls 'my test dir'"
echo "Space filename tests complete."
delay 200

echo "--- Test: Advanced find commands (-exec, -delete, operators) ---"
mkdir -p find_exec_test/subdir
touch find_exec_test/file.exec
touch find_exec_test/subdir/another.exec
touch find_exec_test/file.noexec
echo "--- Test -exec to change permissions ---"
find ./find_exec_test -name "*.exec" -exec chmod 777 {} \;
ls -l find_exec_test/
ls -l find_exec_test/subdir/
echo "--- Test -delete and -o (OR) ---"
delay 200
find ./find_exec_test -name "*.noexec" -o -name "another.exec" -delete
ls -R find_exec_test
rm -r find_exec_test
echo "Advanced find tests complete."
delay 200

echo "--- Test: Complex pipes and append redirection (>>) ---"
echo -e "apple\nbanana\norange\napple" > fruit.txt
cat fruit.txt | grep "a" | sort | uniq -c > fruit_report.txt
echo "--- Initial Report ---"
cat fruit_report.txt
echo "One more apple" >> fruit_report.txt
echo "--- Appended Report ---"
cat fruit_report.txt
rm fruit.txt fruit_report.txt
echo "Piping and redirection tests complete."
delay 200

echo "--- Test: Logical OR (||) and interactive flags ---"
check_fail "cat nonexistent_file.txt" || echo "Logical OR successful: cat failed as expected."
echo "YES" > yes.txt
echo "n" > no.txt
touch interactive_test.txt
rm -i interactive_test.txt < yes.txt
check_fail "ls interactive_test.txt"
touch another_file.txt
cp -i another_file.txt overwrite_dir < yes.txt
ls overwrite_dir
cp -f another_file.txt overwrite_dir
rm no.txt yes.txt another_file.txt
echo "Interactive flag and logical OR tests complete."
delay 400

echo "---------------------------------------------------------------------"

echo ""
echo "===== Phase 16: Testing Paranoid Security & Edge Cases ====="
delay 200
echo "--- Test: Advanced 'awk' with BEGIN/END blocks ---"
echo -e "10 alpha\n20 bravo\n30 charlie" > awk_data.txt
awk 'BEGIN { print "Report Start" } { print "Item " NR ":", $2 } END { print "Report End" }' awk_data.txt
rm awk_data.txt
delay 200
echo "--- Test: Scripting scope (ensure child script cannot modify parent shell) ---"
echo 'set CHILD_VAR="i am from the child"' > set_var.sh
chmod 700 ./set_var.sh
run ./set_var.sh
check_fail -z "echo $CHILD_VAR"
rm set_var.sh
echo "Scripting scope test complete."
delay 200
echo "--- Test: 'find' and 'xargs' with spaced filenames ---"
rm -f "a file with spaces.tmp"
touch "a file with spaces.tmp"
find . -name "*.tmp" | xargs rm
check_fail "ls \"a file with spaces.tmp\""
echo "'find' and 'xargs' with spaces test complete."
delay 200
echo "--- Test: Input redirection and empty file creation ---"
> empty_via_redir.txt
echo "some data" > input.txt
cat < input.txt
rm empty_via_redir.txt input.txt
echo "Redirection tests complete."
echo "---------------------------------------------------------------------"
echo "===== Phase 17: Testing 'run' Command & Script Execution ====="
delay 200

echo "--- Test: Basic script execution ---"
# Create a simple script to be executed.
echo 'echo "Hello from a run script!"' > simple_test.sh
chmod 755 simple_test.sh
# Run it!
run ./simple_test.sh
rm simple_test.sh
echo "Basic execution test complete."
delay 200

echo "--- Test: Script argument passing ---"
# Create a script that prints its arguments.
echo '#!/bin/oopis_shell' > arg_passing_test.sh
echo 'echo "Arg 1: $1, Arg 2: $2, Arg Count: $#, All Args: $@" ' >> arg_passing_test.sh
chmod 755 arg_passing_test.sh
# Run the script with various arguments.
run ./arg_passing_test.sh first "second arg" third
rm arg_passing_test.sh
echo "Argument passing test complete."
delay 200

echo "--- Test: Script environment sandboxing ---"
# Create a script that sets a variable.
echo 'set CHILD_VAR="i am from the child"' > scope_test.sh
chmod 755 ./scope_test.sh
# Run the script.
run ./scope_test.sh
# Now, check if that variable leaked into our current shell. It shouldn't have!
# 'check_fail -z' will SUCCEED if the echo command produces NO output.
check_fail -z "echo $CHILD_VAR"
rm scope_test.sh
echo "Script sandboxing test complete."
delay 400

echo "---------------------------------------------------------------------"
echo "--- 'run' command diagnostics finished ---"
echo ""

echo ""
echo "===== Phase 18: Testing Symbolic Link Infrastructure ====="
delay 200

echo "--- Test: Symlink creation and display ---"
echo "This is the original target file." > original_target.txt
ln -s original_target.txt my_link
echo "Verifying link display with 'ls -l':"
ls -l my_link

echo "--- Test: Symlink content resolution via 'cat' ---"
cat my_link
delay 200

echo "--- Test: 'rm' behavior on symlinks vs. targets ---"
echo "Removing the link 'my_link'..."
rm my_link
echo "Verifying original file still exists:"
ls original_target.txt
delay 200
echo "Recreating link and removing the target..."
ln -s original_target.txt my_link
rm original_target.txt
echo "Verifying link is now dangling (ls should still show it):"
ls -l my_link
delay 200
check_fail "cat my_link"
echo "Dangling link test complete."
delay 200

echo "--- Test: Symlink infinite loop detection (CRUCIAL) ---"
ln -s link_b link_a
ln -s link_a link_b
echo "Attempting to cat a circular link (should fail gracefully)..."
check_fail "cat link_a"
echo "Loop detection test complete."
delay 200

echo "Symbolic link tests complete."
echo "---------------------------------------------------------------------"
delay 200

echo ""
echo "===== Phase 19: Advanced Job Control & Signal Handling ====="
delay 200

echo "--- Test: Non-interactive 'top' launch ---"
top &
TOP_PID=$(ps | grep "top" | awk '{print $1}')
delay 1500
kill $TOP_PID || true
echo "'top' non-interactive test complete."
delay 200

echo "--- Test: Starting a long-running background job ---"
delay 30000 &
# Use ps and grep to get the job ID programmatically
JOB_ID=$(ps | grep "delay" | awk '{print $1}')
echo "Started background job with PID: $JOB_ID"
delay 200

echo "--- Test: Verifying job is 'Running' (R) with 'ps' and 'jobs' ---"
ps | grep "$JOB_ID" | grep 'R'
jobs
echo "Job status is correctly reported as 'R'."
delay 200

echo "--- Test: Pausing the job with 'kill -STOP' ---"
kill -STOP $JOB_ID
echo "Signal -STOP sent to job $JOB_ID."
delay 1000

echo "--- Test: Verifying job is 'Stopped' (T) ---"
ps | grep "$JOB_ID" | grep 'T'
jobs
echo "Job status is correctly reported as 'T'."
delay 400

echo "--- Test: Resuming the job with 'bg' ---"
bg %$JOB_ID
echo "'bg' command sent to job $JOB_ID."
delay 400

echo "--- Test: Verifying job is 'Running' (R) again ---"
ps | grep "$JOB_ID" | grep 'R'
jobs
echo "Job status is correctly reported as 'R' after resuming."
delay 400

echo "--- Test: Terminating the job with 'kill' ---"
kill -KILL $JOB_ID
echo "Signal -KILL sent to job $JOB_ID."
delay 1000

echo "--- Test: Verifying job has been terminated ---"
# This check will SUCCEED if grep finds nothing.
check_fail -z "ps | grep '$JOB_ID'"
jobs
echo "Job successfully terminated and removed from process lists."
delay 400
echo "---------------------------------------------------------------------"
echo ""

echo "===== Phase 20: Testing Stream & Text Manipulation Commands ====="
delay 200

echo "--- Test: nl (Number Lines) Command ---"
# Create a test file with blank lines
echo -e "First line.\n\nThird line." > nl_test.txt
echo "Testing nl on a file with blank lines:"
nl nl_test.txt
delay 200
echo "Testing nl on piped input:"
cat nl_test.txt | nl
rm nl_test.txt
echo "nl test complete."
delay 200

echo "--- Test: sed (Stream Editor) Command ---"
echo "Create a test file for substitution..."
delay 400
echo "The quick brown fox jumps over the lazy dog." > sed_test.txt
echo "The fox is a fox." >> sed_test.txt
echo "Original content:"
cat sed_test.txt
delay 200
echo "Testing single substitution:"
cat sed_test.txt | sed 's/fox/cat/'
delay 200
echo "Testing global substitution:"
cat sed_test.txt | sed 's/fox/cat/g'
rm sed_test.txt
echo "sed test complete."
delay 400
echo "Create a test file for cutting..."
delay 200
echo "first:second:third:fourth" > cut_test.txt
echo "apple,orange,banana,grape" >> cut_test.txt
echo "one;two;three;four" >> cut_test.txt
echo "--- Test: cut with colon delimiter ---"
cut -d: -f1,3 cut_test.txt
delay 200
echo "--- Test: cut with comma delimiter from pipe ---"
cat cut_test.txt | grep "apple" | cut -d, -f2,4
delay 200
echo "--- Test: cut with semicolon delimiter ---"
cut -d';' -f2,3,4 cut_test.txt
delay 200
echo "--- Test: check_fail on missing fields flag ---"
check_fail "cut -d, cut_test.txt"
delay 200
rm cut_test.txt
echo "'cut' command diagnostics finished."
delay 400
echo "---------------------------------------------------------------------"
echo "---------------------------------------------------------------------"

echo ""
echo "===== Phase 21: Testing 'tr' Command Suite ====="
delay 200

echo "--- Test: tr - Basic translation (lower to upper) ---"
echo "hello world" | tr 'a-z' 'A-Z'
delay 200

echo "--- Test: tr - Character class translation ---"
echo "test 123" | tr '[:lower:]' '[:upper:]'
delay 200

echo "--- Test: tr -d (delete) with character class ---"
echo "abc-123-def" | tr -d '[:digit:]'
delay 200

echo "--- Test: tr -s (squeeze-repeats) ---"
echo "hellloooo     woooorld" | tr -s 'o'
delay 200

echo "--- Test: tr -c (complement) ---"
echo "123abc456" | tr -c '[:digit:]' '_'
delay 200

echo "--- Test: tr -cs (complement and squeeze) ---"
echo "###Hello... World!!!" | tr -cs '[:alnum:]' '_'
delay 200
echo "---------------------------------------------------------------------"

echo ""
echo "===== Phase 22: Testing 'comm' Command Suite ====="
delay 200

echo "--- Test: comm - Creating sorted test files ---"
echo -e "apple\nbanana\ncommon\npear" > comm_a.txt
echo -e "banana\ncommon\norange\nstrawberry" > comm_b.txt
delay 200

echo "--- Test: comm - Default (three columns) ---"
comm comm_a.txt comm_b.txt
delay 200

echo "--- Test: comm - Suppress column 1 (-1) ---"
comm -1 comm_a.txt comm_b.txt
delay 200

echo "--- Test: comm - Suppress column 2 (-2) ---"
comm -2 comm_a.txt comm_b.txt
delay 200

echo "--- Test: comm - Suppress column 1 and 3 (-13) ---"
comm -13 comm_a.txt comm_b.txt
delay 200

echo "--- Test: comm - Suppress column 1 and 2 (-12) ---"
comm -12 comm_a.txt comm_b.txt
delay 200

echo "--- Cleaning up comm test files ---"
rm comm_a.txt comm_b.txt
echo "comm test complete."
delay 400
echo "---------------------------------------------------------------------"

echo ""
echo "===== Phase 23: Testing Binder Command Suite ====="
delay 200

echo "--- Setting up binder test environment ---"
mkdir -p binder_test/docs binder_test/assets
echo "research data" > binder_test/docs/research.txt
echo "project notes" > binder_test/notes.txt
echo "asset" > binder_test/assets/icon.svg
delay 400

echo "--- Test: binder create ---"
binder create project_alpha
ls project_alpha.binder
delay 400

echo "--- Test: binder add (with sections) ---"
binder add project_alpha.binder ./binder_test/docs/research.txt -s documents
binder add project_alpha.binder ./binder_test/notes.txt -s general
binder add project_alpha.binder ./binder_test/assets/icon.svg -s assets
delay 400

echo "--- Test: binder list ---"
binder list project_alpha.binder
delay 400

echo "--- Test: binder exec ---"
echo "Executing 'cksum' on all files in the binder:"
binder exec project_alpha.binder -- cksum {}
delay 400

echo "--- Test: binder remove ---"
binder remove project_alpha.binder ./binder_test/notes.txt
delay 400

echo "--- Test: binder list (after removal) ---"
binder list project_alpha.binder
delay 400

echo "--- Cleaning up binder test environment ---"
rm -r -f binder_test
rm project_alpha.binder
echo "Binder command suite test complete."
delay 400
echo "---------------------------------------------------------------------"

echo ""
echo "===== Phase 24: Testing Agenda Command (Non-Interactive) ====="
delay 200

echo "--- Test: Scheduling a job with sudo ---"
# Use sudo to add a job. The daemon should start as root.
sudo agenda add "* * * * *" "echo agenda_test"
delay 2000 # Give the daemon a moment to process and save

echo "--- Test: Listing the job ---"
# Anyone should be able to list the jobs.
agenda list

echo "--- Test: Verifying schedule file ownership (should be root) ---"
# The agenda.json file should be owned by root if it exists.
echo "Checking if agenda daemon created the schedule file..."
delay 2000
echo "Attempting to check file ownership (may show error if file doesn't exist):"
ls -l /etc/agenda.json || echo "Note: /etc/agenda.json not found - this is expected if no jobs were persisted"

echo "--- Test: Removing the job with sudo ---"
# Removing a job also requires root privileges.
sudo agenda remove 1
delay 500 # Give the daemon time to process the removal

echo "--- Test: Verifying job removal ---"
agenda list

# Clean up the test file
rm /etc/agenda.json || echo "Note: /etc/agenda.json was not found during cleanup."

echo "Agenda command test complete."
delay 400
echo "---------------------------------------------------------------------"

echo "---------------------------------------------------------------------"
echo ""
echo "===== Phase 25: Testing Brace Expansion Features ====="
delay 200

echo "--- Test: Comma expansion {a,b,c} ---"
echo "Testing basic comma expansion:"
echo {hello,world,test}
delay 200

echo "--- Test: File operations with comma expansion ---"
touch test_file.txt
cp test_file.txt{,.bak}
ls test_file*
rm test_file.txt test_file.txt.bak
echo "File copy with brace expansion complete."
delay 200

echo "--- Test: Directory creation with comma expansion ---"
mkdir {dir1,dir2,dir3}
ls -d dir*
rmdir dir1 dir2 dir3
echo "Directory creation with brace expansion complete."
delay 200

echo "--- Test: Numeric sequence expansion {1..5} ---"
echo "Testing numeric sequence:"
echo {1..5}
delay 200

echo "--- Test: Reverse numeric sequence {5..1} ---"
echo "Testing reverse numeric sequence:"
echo {5..1}
delay 200

echo "--- Test: Alphabetic sequence expansion {a..e} ---"
echo "Testing alphabetic sequence:"
echo {a..e}
delay 200

echo "--- Test: Reverse alphabetic sequence {e..a} ---"
echo "Testing reverse alphabetic sequence:"
echo {e..a}
delay 200

echo "--- Test: File creation with sequence expansion ---"
touch file{1..3}.txt
ls file*.txt
rm file1.txt file2.txt file3.txt
echo "File creation with sequence expansion complete."
delay 200

echo "--- Test: Complex brace expansion with paths ---"
mkdir -p test_dir/{sub1,sub2,sub3}
ls -R test_dir/
rm -r test_dir
echo "Complex path expansion complete."
delay 200

echo "--- Test: Mixed expansion types ---"
echo "Testing mixed comma and sequence:"
echo prefix_{1..3,a,b}_suffix
delay 200

echo "Brace expansion tests complete."

echo "===== Phase X: Testing Filesystem Torture & I/O Gauntlet ====="
delay 200

echo "--- Test: Handling of obnoxious filenames ---"
mkdir -p "./a directory with spaces and.. special'chars!"
touch "./a directory with spaces and.. special'chars!/-leading_dash.txt"
echo "obnoxious" > "./a directory with spaces and.. special'chars!/test.txt"
delay 200
ls -l "./a directory with spaces and.. special'chars!"
cat "./a directory with spaces and.. special'chars!/test.txt"
rm -r -f "./a directory with spaces and.. special'chars!"
check_fail "ls './a directory with spaces and.. special'chars!'"
echo "Obnoxious filename tests complete."
delay 200

echo "--- Test: File ownership vs. permissions paradox ---"
delay 200
touch paradox.txt
chown paradoxuser paradox.txt
chmod 000 paradox.txt
logout
su paradoxuser testpass
check_fail "cat /paradox.txt"
echo "Permission paradox test complete."
delay 200
logout
delay 200
su diagUser testpass
cd /home/diagUser/diag_workspace
delay 400
echo "---------------------------------------------------------------------"

echo ""
echo "===== Phase Z: Testing Process & State Integrity Under Stress ====="
delay 200

echo "--- Test: Background process race condition ---"
echo "one" > race.txt &
echo "two" > race.txt &
echo "three" > race.txt &
delay 400
echo "Race condition test initiated. Final content of race.txt:"
cat race.txt
rm race.txt
echo "Race condition test complete."
delay 200

echo ""
echo "===== Phase Alpha: Core Command & Flag Behavior ====="
delay 200

echo "--- Test: diff Command ---"
echo -e "line one\nline two\nline three" > diff_a.txt
echo -e "line one\nline 2\nline three" > diff_b.txt
diff diff_a.txt diff_b.txt
rm diff_a.txt diff_b.txt
echo "diff test complete."
delay 200

echo "--- Test: cp -p (Preserve Permissions) ---"
touch preserve_perms.txt
chmod 700 preserve_perms.txt
delay 200
cp -p preserve_perms.txt preserve_copy.sh
echo "Verifying preserved permissions:"
ls -l preserve_perms.txt preserve_copy.sh
rm preserve_perms.txt preserve_copy.sh
echo "cp -p test complete."
delay 200

echo "--- Test: touch with Time-Stamping ---"
touch -d "1 day ago" old_file.txt
touch -t 202305201200.30 specific_time.txt
echo "Verifying timestamps:"
ls -l old_file.txt specific_time.txt
rm old_file.txt specific_time.txt
echo "touch timestamp test complete."
delay 400
echo "---------------------------------------------------------------------"

echo ""
echo "===== Phase Beta: Group Permissions & Sudo ====="
delay 200
logout
echo "--- Test: Group Permissions ---"
delay 200
usermod -aG testgroup testuser
touch /home/diagUser/diag_workspace/group_test_file.txt
chown diagUser /home/diagUser/diag_workspace/group_test_file.txt
chgrp testgroup /home/diagUser/diag_workspace/group_test_file.txt
chmod 664 /home/diagUser/diag_workspace/group_test_file.txt
delay 200
su testuser testpass
cd /home/diagUser/diag_workspace
echo "Appending to file as group member (should succeed)..."
echo "appended" >> /home/diagUser/diag_workspace/group_test_file.txt
cat /home/diagUser/diag_workspace/group_test_file.txt
logout
su Guest
echo "Appending to file as Guest (should fail)..."
check_fail "echo 'appended by guest' >> /home/diagUser/diag_workspace/group_test_file.txt"
echo "Group permissions test complete."
delay 200

echo ""
echo "===== Phase Delta: Advanced Data & Process Management ====="
delay 200
logout
su diagUser testpass
cd /home/diagUser/diag_workspace

echo "--- Test: sort Flags ---"
echo -e "10\n2\napple\nbanana\napple" > sort_test.txt
echo "Numeric sort:"
sort -n sort_test.txt
echo "Reverse sort:"
sort -r sort_test.txt
echo "Unique sort:"
sort -u sort_test.txt
delay 200
rm sort_test.txt
echo "sort test complete."
delay 200

echo "--- Test: find with -exec and -delete ---"
mkdir find_exec_test
delay 200
touch find_exec_test/test.exec
touch find_exec_test/test.noexec
echo "Changing permissions with find -exec..."
find ./find_exec_test -name "*.exec" -exec chmod 777 {} \;
ls -l find_exec_test
delay 200
echo "Deleting with find -delete..."
find ./find_exec_test -name "*.noexec" -delete
ls -l find_exec_test
rm -r find_exec_test
echo "find actions test complete."
delay 200

echo "--- Test: Pagers (more, less) Non-Interactive ---"
echo -e "line 1\nline 2\nline 3" > pager_test.txt
echo "Piping to 'more'..."
cat pager_test.txt | more | wc -l
echo "Piping to 'less'..."
cat pager_test.txt | less | wc -l
rm pager_test.txt
echo "Pager test complete."
delay 200

echo "--- Test: Input Redirection (<) ---"
echo "Redirected input" > input_redir.txt
cat < input_redir.txt
rm input_redir.txt
echo "Input redirection test complete."
delay 400
echo "---------------------------------------------------------------------"


echo ""
echo "===== Phase Theta: Filesystem Integrity & Edge Cases ====="
delay 200

echo "--- Test: rmdir on Non-Empty Directory ---"
mkdir non_empty_dir
touch non_empty_dir/file.txt
check_fail "rmdir non_empty_dir"
rm -r non_empty_dir
echo "rmdir on non-empty test complete."
delay 200

echo "--- Test: File I/O with Special Characters ---"
mkdir "a directory with spaces and.. special'chars!"
touch "a directory with spaces and.. special'chars!/-leading_dash.txt"
echo "Special content" > "a directory with spaces and.. special'chars!/-leading_dash.txt"
cat "a directory with spaces and.. special'chars!/-leading_dash.txt"
rm -r "a directory with spaces and.. special'chars!"
echo "Special characters test complete."
delay 200

echo "--- Test: xargs with Quoted Arguments ---"
rm -f "a file with spaces.tmp" "a file with spaces.tmp.bak"
touch "a file with spaces.tmp"
ls *.tmp | xargs -I {} mv {} {}.bak
ls *.bak
delay 200
rm *.bak
echo "xargs with quotes test complete."
delay 400
echo "---------------------------------------------------------------------"

echo ""
echo "===== Phase Gamma: Testing Diff and Patch Integration ====="
delay 200

echo "--- Test: Creating base files for diff and patch ---"
echo -e "The original first line.\nA second line, which will remain.\nThe third line is the charm." > original_document.txt
echo -e "The first line, now modified.\nA second line, which will remain.\nThe third line is the charm." > modified_document.txt
echo "Base files created."
delay 200

echo "--- Test: Generating a patch file with a custom utility ---"
# This simulates creating a patch object. A real 'diff' would output text,
# but for this test, we'll create the JSON patch our command expects.
diff -u original_document.txt modified_document.txt > changes.diff
echo "Patch file 'changes.diff' generated. Contents:"
cat changes.diff
delay 200

echo "--- Test: Applying the patch to the original file ---"
patch original_document.txt changes.diff
echo "Patch applied."
delay 200

echo "--- Test: Verifying the patched file (should show no differences) ---"
# We'll use 'check_fail -z' which SUCCEEDS if the command has ZERO output.
# A successful patch means 'diff' will find no differences and produce no output.
check_fail -z "diff original_document.txt modified_document.txt"
echo "Verification complete. If no failure was reported, the test was successful."
delay 200

echo "--- Cleaning up patch test files ---"
rm original_document.txt modified_document.txt changes.diff
echo "Patch integration test complete."
delay 400

echo ""
echo "--- Phase Omega: Final Cleanup ---"
cd /
logout
delay 300
removeuser -f diagUser
removeuser -f sudouser
removeuser -f testuser
removeuser -f testuser2
removeuser -f comm_user1
removeuser -f comm_user2
removeuser -f limitedsudo
removeuser -f paradoxuser
removeuser -f recursive_test_user
removeuser -f sudouser2
delay 200
rm -r -f /home/diagUser
rm -r -f /home/sudouser
rm -r -f /home/testuser
rm -r -f /home/testuser2
rm -r -f /home/comm_user1
rm -r -f /home/comm_user2
rm -r -f /home/limitedsudo
rm -r -f /home/paradoxuser
rm -r -f /home/recursive_test_user
rm -r -f /home/sudouser2
rm -r -f /home/sudouser2
rm -r -f /find_test
rm -r -f /overwrite_dir
rm -r -f /recursive_test
rm -r -f /zip_test
rm -r -f /tmp/*
rm -r -f /home/Guest/recursive_test_user
rm -f /awk_test.csv
rm -f /interactive_test.txt
rm -f /link_a
rm -f /link_b
rm -f /my_archive.zip
rm -f /my_link
rm -f /paradox.txt
rm -f /uniq_test.txt
rm -f /screen.txt


delay 200

groupdel testgroup
groupdel recursive_test_group
groupdel harvest_festival

login Guest
listusers
delay 200

delay 400
echo "---------------------------------------------------------------------"
echo ""
echo "      ===== OopisOS Core Test Suite v5.1 Complete ======="
echo " "
delay 500
echo "  ======================================================"
delay 150
echo "  ==                                                  =="
delay 150
echo "  ==           OopisOS Core Diagnostics               =="
delay 150
echo "  ==            ALL SYSTEMS OPERATIONAL               =="
delay 150
echo "  ==                                                  =="
delay 150
echo "  ======================================================"
echo " "
delay 400
echo "(As usual, you've been a real pantload!)"
beep; beep
delay 650
echo " "
echo " "
delay 200
play E6 20n; play F6 32n; play F#6 32n; play A6 32n; play D7 64n