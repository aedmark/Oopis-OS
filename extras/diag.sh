# OopisOS Core Test Suite v4.2 - "The Gauntlet, Now With More Gauntlet"
echo "===== OopisOS Core Test Suite v4.2 Initializing ====="
echo "This script tests all non-interactive core functionality, now with maximum paranoia."
echo "---------------------------------------------------------------------"
echo ""

# --- Phase 1: Test User & Workspace Setup ---
echo "--- Phase 1: Creating dedicated test user and workspace ---"
login root mcgoopis
delay 400
useradd diagUser
testpass
testpass
mkdir -p /home/diagUser/diag_workspace/
chown diagUser /home/diagUser/diag_workspace/
groupadd testgroup
chgrp testgroup /home/diagUser/diag_workspace/
chmod 775 /home/diagUser/diag_workspace/
delay 500
login diagUser testpass
echo "Current User (expected: diagUser):"
whoami
echo "Current Path after login (expected: /home/diagUser):"
pwd
cd /home/diagUser/diag_workspace
delay 400
echo "---------------------------------------------------------------------"

# --- Phase 2: Create All Diagnostic Assets ---
echo ""
echo "--- Phase 2: Creating diagnostic assets ---"
# Basic FS assets
mkdir -p src mv_test_dir overwrite_dir find_test/subdir zip_test/nested_dir "a dir with spaces"
mkdir -p recursive_test/level2/level3
# Text/diff assets
echo -e "line one\nline two\nline three" > diff_a.txt
echo -e "line one\nline 2\nline three" > diff_b.txt
# Permissions assets
echo "I should not be executable" > exec_test.sh; chmod 600 exec_test.sh
touch preserve_perms.txt; chmod 700 preserve_perms.txt
# Data processing assets
echo -e "zeta\nalpha\nbeta\nalpha\n10\n2" > sort_test.txt
echo "The quick brown fox." > text_file.txt
echo -e "apple\nbanana\napple\napple\norange\nbanana" > uniq_test.txt
echo -e "id,value,status\n1,150,active\n2,80,inactive\n3,200,active" > awk_test.csv
# xargs assets
touch file1.tmp file2.tmp file3.tmp
# find assets
touch find_test/a.txt find_test/b.tmp find_test/subdir/c.tmp
chmod 777 find_test/a.txt
# zip assets
echo "file one content" > zip_test/file1.txt
echo "nested file content" > zip_test/nested_dir/file2.txt
# Scripting assets
echo '#!/bin/oopis_shell' > arg_test.sh
echo 'echo "Arg 1: $1, Arg 2: $2, Arg Count: $#, All Args: $@" ' >> arg_test.sh
chmod 700 arg_test.sh
echo '#!/bin/oopis_shell' > infinite_loop.sh
echo 'run ./infinite_loop.sh' >> infinite_loop.sh
chmod 700 infinite_loop.sh
# ls sorting assets
touch -d "2 days ago" old.ext
touch -d "1 day ago" new.txt
echo "short" > small.log
echo "this is a very long line" > large.log
# Recursive test assets
echo "I am a secret" > recursive_test/secret.txt
echo "I am a deeper secret" > recursive_test/level2/level3/deep_secret.txt
# State management test asset
echo "Original State" > state_test.txt
echo "Asset creation complete."
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 3: Core FS Commands & Flags (Expanded) ---
echo ""
echo "===== Phase 3: Testing Core FS Commands (Expanded) ====="
delay 400
echo "--- Test: diff, cp -p, mv ---"
diff diff_a.txt diff_b.txt
cp -p preserve_perms.txt preserve_copy.sh
echo "Verifying preserved permissions:"
ls -l preserve_perms.txt preserve_copy.sh
mv exec_test.sh mv_test_dir/
ls mv_test_dir/
echo "--- Test: touch -d and -t ---"
touch -d "1 day ago" old_file.txt
touch -t 202305201200.30 specific_time.txt
ls -l old_file.txt specific_time.txt
echo "--- Test: ls sorting flags (-t, -S, -X, -r) ---"
echo "Sorting by modification time (newest first):"
ls -lt
echo "Sorting by size (largest first):"
ls -lS
echo "Sorting by extension:"
ls -lX
echo "Sorting by name in reverse order:"
ls -lr
echo "--- Test: cat -n ---"
cat -n diff_a.txt
delay 700
echo "--- Test: cd into a file (should fail) ---"
delay 200
echo "this is a file" > not_a_directory.txt
delay 300
check_fail "cd not_a_directory.txt"
delay 200
rm not_a_directory.txt
echo "---------------------------------------------------------------------"


# --- Phase 4: Group Permissions and Ownership (Expanded) ---
echo ""
echo "===== Phase 4: Testing Group Permissions & Ownership (Expanded) ====="
delay 400
login root mcgoopis
useradd testuser
testpass
testpass
usermod -aG testgroup testuser
groups testuser
# Create the directory for the cd permission test as root
mkdir -p /tmp/no_exec_dir
chmod 644 /tmp/no_exec_dir
# Set up the group test file as root
chmod 755 /home/diagUser # Allow testuser to cd into diagUser home
cd /home/diagUser/diag_workspace
echo "Initial content" > group_test_file.txt
chown diagUser group_test_file.txt
chgrp testgroup group_test_file.txt
chmod 664 group_test_file.txt
echo "--- Test: Group write permission ---"
login testuser testpass
cd /home/diagUser/diag_workspace
echo "Append by group member" >> group_test_file.txt
cat group_test_file.txt
echo "--- Test: 'Other' permissions (should fail) ---"
login Guest
cd /home/diagUser/diag_workspace
check_fail "echo 'Append by other user' >> group_test_file.txt"
echo "--- Test: Permission Edge Cases ---"
login testuser testpass
check_fail "chmod 777 /home/diagUser/diag_workspace/group_test_file.txt" # testuser is not owner
check_fail "cd /tmp/no_exec_dir" # testuser cannot execute
login root mcgoopis
rm -r -f /tmp
removeuser -f testuser
groupdel testgroup
rm -f /home/diagUser/diag_workspace/group_test_file.txt
chmod 700 /home/diagUser
login diagUser testpass
cd /home/diagUser/diag_workspace
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 5: Sudo & Security Model ---
echo ""
echo "===== Phase 5: Testing Sudo & Security Model ====="
delay 400
login root mcgoopis
useradd sudouser
testpass
testpass
echo "sudouser ALL" >> /etc/sudoers
login sudouser testpass
echo "Attempting first sudo command (password required)..."
sudo echo "Sudo command successful."
testpass
echo "Attempting second sudo command (should not require password)..."
sudo ls /home/root
login Guest
check_fail "sudo ls /home/root"
login root mcgoopis
removeuser -f sudouser
grep -v "sudouser" /etc/sudoers > sudoers.tmp; mv sudoers.tmp /etc/sudoers
echo "--- Test: Granular sudo permissions ---"
useradd sudouser2
testpass
testpass
echo "sudouser2 ls" >> /etc/sudoers
login sudouser2 testpass
echo "Attempting allowed specific command (ls)..."
sudo ls /home/root
testpass
echo "Attempting disallowed specific command (rm)..."
check_fail "sudo rm -f /home/Guest/README.md"
login root mcgoopis
removeuser -f sudouser2
grep -v "sudouser2" /etc/sudoers > sudoers.tmp; mv sudoers.tmp /etc/sudoers
login diagUser testpass
cd /home/diagUser/diag_workspace
echo "Granular sudo test complete."
delay 700
echo "---------------------------------------------------------------------"


# --- Phase 6: Advanced Scripting & Process Management ---
echo ""
echo "===== Phase 6: Testing Scripting & Process Management ====="
delay 400
echo "--- Test: Script argument passing ---"
run ./arg_test.sh first "second arg" third
echo "--- Test: Script execution governor (expect graceful failure) ---"
check_fail "run ./infinite_loop.sh"
echo "--- Test: Background jobs (ps, kill) ---"
delay 5000 &
ps
ps | grep delay | awk '{print $1}' | xargs kill
ps
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 7: Advanced Data Processing & Text Utilities ---
echo ""
echo "===== Phase 7: Testing Data Processing & Text Utilities ======="
delay 400
echo "--- Test: sort (-n, -r, -u) ---"
sort -r sort_test.txt
sort -n sort_test.txt
sort -u sort_test.txt
echo "--- Test: wc (-l, -w, -c) ---"
wc text_file.txt
wc -l -w -c text_file.txt
echo "--- Test: head/tail (-n, -c) ---"
head -n 1 text_file.txt
tail -c 5 text_file.txt
echo "--- Test: grep flags (-i, -v, -c) ---"
grep -i "FOX" text_file.txt
grep -c "quick" text_file.txt
grep -v "cat" text_file.txt
echo "--- Test: xargs and pipe awareness ---"
ls -1 *.tmp | xargs rm
check_fail "ls file1.tmp"
echo "xargs deletion verified."
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 8: find and Archival Commands ---
echo ""
echo "===== Phase 8: Testing 'find' and Archival (zip/unzip) ====="
delay 400
echo "--- Test: find by name, type, and permissions ---"
find find_test -name "*.tmp"
find find_test -type d
find find_test -perm 777
echo "--- Test: zip/unzip ---"
zip my_archive.zip ./zip_test
rm -r -f zip_test
unzip my_archive.zip .
ls -R zip_test
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 9: Pager and Calculator Tests ---
echo ""
echo "===== Phase 9: Testing Pager and Calculator Tests ====="
delay 400
echo "--- Test: bc command (pipe and argument) ---"
echo "5 * (10 - 2) / 4" | bc
bc "100 + 1"
check_fail "bc '5 / 0'"
echo "--- Test: Pager integration (non-interactive pipe-through) ---"
echo -e "Line 1\nLine 2\nLine 3" > pager_test.txt
cat pager_test.txt | more | wc -l
cat pager_test.txt | less | wc -l
echo "Pager pass-through test complete."
echo "--- Test: Input Redirection (<) ---"
echo "hello redirect" > input_redir.txt
cat < input_redir.txt
rm pager_test.txt input_redir.txt
echo "Input redirection test complete."
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 10: Data Transformation & Integrity Commands ---
echo ""
echo "===== Phase 10: Testing Data Transformation & Integrity Commands ====="
delay 400
echo "--- Test: rmdir ---"
mkdir empty_dir
rmdir empty_dir
check_fail "ls empty_dir"
mkdir non_empty_dir; touch non_empty_dir/file.txt
check_fail "rmdir non_empty_dir"
rm -r non_empty_dir
echo "rmdir tests complete."
delay 400
echo "--- Test: base64 (encode/decode) ---"
echo "The Tao is eternal." > b64_test.txt
base64 b64_test.txt > b64_encoded.txt
base64 -d b64_encoded.txt
rm b64_test.txt b64_encoded.txt
echo "base64 tests complete."
delay 400
echo "--- Test: xor (encrypt/decrypt) ---"
echo "Harmony and order." > xor_test.txt
xor diag_pass xor_test.txt > xor_encrypted.txt
xor diag_pass xor_encrypted.txt
rm xor_test.txt xor_encrypted.txt
echo "xor tests complete."
delay 400
echo "--- Test: ocrypt (secure encrypt/decrypt) ---"
echo "A truly secure message." > ocrypt_test.txt
ocrypt -e diag_secure_pass ocrypt_test.txt
ocrypt -d diag_secure_pass ocrypt_test.txt | grep "A truly secure message."
rm ocrypt_test.txt
echo "ocrypt secure tests complete."
delay 400
echo "--- Test: cksum and sync ---"
echo "A well-written program is its own Heaven." > cksum_test.txt
cksum cksum_test.txt
sync
echo "A poorly-written program is its own Hell." >> cksum_test.txt
cksum cksum_test.txt
rm cksum_test.txt
echo "cksum and sync tests complete."
delay 400
echo "--- Test: csplit ---"
echo "alpha" > csplit_test.txt
echo "bravo" >> csplit_test.txt
echo "charlie" >> csplit_test.txt
echo "delta" >> csplit_test.txt
echo "echo" >> csplit_test.txt
csplit csplit_test.txt 3
ls xx*
rm -f xx00 xx01 csplit_test.txt
echo "csplit test complete."
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 11: Testing Underrepresented Commands (Data/System) ---
echo ""
echo "===== Phase 11: Testing Underrepresented Commands (Data/System) ====="
delay 400
echo "--- Test: uniq (-d, -u) ---"
sort uniq_test.txt | uniq -d
sort uniq_test.txt | uniq -u
echo "--- Test: awk scripting ---"
echo "Printing active users with values over 100 from csv"
awk -F, '/,active/ { print "User " $1 " is " $3 }' awk_test.csv
echo "--- Test: shuf (-i, -e) ---"
shuf -i 1-5 -n 3
shuf -e one two three four five
echo "--- Test: tree (-L, -d) ---"
tree -L 2 ./recursive_test
tree -d ./recursive_test
echo "--- Test: du (recursive) and grep (-R) ---"
du recursive_test/
grep -R "secret" recursive_test/
echo "Underrepresented data command tests complete."
delay 700
echo "---------------------------------------------------------------------"


# --- Phase 12: Shell & Session Commands ---
echo ""
echo "===== Phase 12: Testing Shell & Session Commands ====="
delay 400
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
printscreen screen.log
cat screen.log
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 13: Testing User & State Management ---
echo ""
echo "===== Phase 13: Testing User & State Management ====="
delay 400
echo "--- Test: su and logout ---"
login root mcgoopis
useradd testuser2
newpass
newpass
su testuser2 newpass
whoami
logout
whoami
echo "--- Test: savestate and loadstate ---"
login diagUser testpass
cd /home/diagUser/diag_workspace
savestate
echo "Modified State" > state_test.txt
loadstate
YES
cat state_test.txt
echo "User & State Management tests complete."
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 14: Testing Network & System Documentation Commands ---
echo ""
echo "===== Phase 14: Testing Network & System Documentation Commands ====="
delay 400
echo "--- Test: wget and curl ---"
wget -O wget.txt https://raw.githubusercontent.com/aedmark/Oopis-OS/refs/heads/master/docs/LICENSE.txt
cat wget.txt
rm wget.txt
curl https://raw.githubusercontent.com/aedmark/Oopis-OS/refs/heads/master/docs/LICENSE.txt > oopis_curl.txt
cat oopis_curl.txt
rm oopis_curl.txt
echo "--- Test: man and help ---"
man ls
help cp
echo "Network & Docs tests complete."
delay 700
echo "---------------------------------------------------------------------"


# --- Phase 15: Edge Case Gauntlet (Expanded) ---
echo ""
echo "===== Phase 15: Testing Edge Cases & Complex Scenarios (Expanded) ====="
delay 400

echo "--- Test: Filenames with spaces ---"
mkdir "my test dir"
echo "hello space" > "my test dir/file with spaces.txt"
ls "my test dir"
cat "my test dir/file with spaces.txt"
mv "my test dir" "your test dir"
ls "your test dir"
rm -r "your test dir"
check_fail "ls 'my test dir'"
echo "Space filename tests complete."
delay 400

echo "--- Test: Advanced find commands (-exec, -delete, operators) ---"
mkdir -p find_exec_test/subdir
touch find_exec_test/file.exec
touch find_exec_test/subdir/another.exec
touch find_exec_test/file.noexec
# Test -exec to change permissions
find ./find_exec_test -name "*.exec" -exec chmod 777 {} \;
ls -l find_exec_test/
ls -l find_exec_test/subdir/
# Test -delete and -o (OR)
find ./find_exec_test -name "*.noexec" -o -name "another.exec" -delete
ls -R find_exec_test
rm -r find_exec_test
echo "Advanced find tests complete."
delay 400

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
delay 400

echo "--- Test: Logical OR (||) and interactive flags ---"
check_fail "cat nonexistent_file.txt" || echo "Logical OR successful: cat failed as expected."
echo "YES" > yes.txt
echo "n" > no.txt
touch interactive_test.txt
# The script runner will auto-reply 'YES' to prompts
# This tests the `rm -i` prompt flow.
rm -i interactive_test.txt < yes.txt
check_fail "ls interactive_test.txt"
# This tests the `cp -i` prompt flow.
touch another_file.txt
cp -i another_file.txt overwrite_dir < yes.txt
ls overwrite_dir
# This tests forced overwrite with `cp -f`
cp -f another_file.txt overwrite_dir
rm no.txt yes.txt another_file.txt
echo "Interactive flag and logical OR tests complete."
delay 700

echo "---------------------------------------------------------------------"

# --- Phase 16: Paranoid Security & Edge Case Testing ---
echo ""
echo "===== Phase 16: Testing Paranoid Security & Edge Cases ====="
delay 400
echo "--- Test: Advanced 'awk' with BEGIN/END blocks ---"
echo -e "10 alpha\n20 bravo\n30 charlie" > awk_data.txt
awk 'BEGIN { print "Report Start" } { print "Item " NR ":", $2 } END { print "Report End" }' awk_data.txt
rm awk_data.txt
delay 400
echo "--- Test: Scripting scope (ensure child script cannot modify parent shell) ---"
echo 'set CHILD_VAR="i am from the child"' > set_var.sh
chmod 700 ./set_var.sh
run ./set_var.sh
check_fail -z "echo $CHILD_VAR"
rm set_var.sh
echo "Scripting scope test complete."
delay 400
echo "--- Test: 'find' and 'xargs' with spaced filenames ---"
touch "a file with spaces.tmp"
find . -name "*.tmp" | xargs rm
check_fail "ls \"a file with spaces.tmp\""
echo "'find' and 'xargs' with spaces test complete."
delay 400
echo "--- Test: Input redirection and empty file creation ---"
> empty_via_redir.txt
echo "some data" > input.txt
cat < input.txt
rm empty_via_redir.txt input.txt
echo "Redirection tests complete."
delay 700
echo "---------------------------------------------------------------------"

# --- Phase X: Filesystem Torture & I/O Gauntlet ---
echo ""
echo "===== Phase X: Testing Filesystem Torture & I/O Gauntlet ====="
delay 400

echo "--- Test: Handling of obnoxious filenames ---"
mkdir -p "./a directory with spaces and.. special'chars!"
touch "./a directory with spaces and.. special'chars!/-leading_dash.txt"
echo "obnoxious" > "./a directory with spaces and.. special'chars!/test.txt"
ls -l "./a directory with spaces and.. special'chars!"
cat "./a directory with spaces and.. special'chars!/test.txt"
rm -r -f "./a directory with spaces and.. special'chars!"
check_fail "ls './a directory with spaces and.. special'chars!'"
echo "Obnoxious filename tests complete."
delay 400

echo "--- Test: 'find' with complex -exec and permission checks ---"
mkdir -p find_torture/ro_subdir
echo "find me" > find_torture/file.txt
echo "don't find me" > find_torture/file.tmp
echo "cant touch this" > find_torture/ro_subdir/secret.txt
login root mcgoopis
chmod 500 /home/diagUser/diag_workspace/find_torture/ro_subdir # Executable but not readable for diagUser
login diagUser testpass
cd /home/diagUser/diag_workspace
# This find should succeed on .txt but fail to cat the secret.txt due to read permissions
find ./find_torture -name "*.txt" -exec cat {} \;
# This should fail because we can't write the output file
check_fail "find ./find_torture -name '*.txt' -exec echo '{}' > ./find_torture/ro_subdir/output.log \;"
# Cleanup
login root mcgoopis
rm -r -f /home/diagUser/diag_workspace/find_torture
login diagUser testpass
cd /home/diagUser/diag_workspace
echo "Complex find tests complete."
delay 700

echo "--- Test: Nested redirection and command substitution simulation ---"
echo "ls -l" > cmd.sh
chmod 700 cmd.sh
# We can't do real command substitution, but we can simulate the I/O flow
run ./cmd.sh > ls_output.txt
cat ls_output.txt | grep "cmd.sh" | wc -l
rm cmd.sh ls_output.txt
echo "Redirection simulation test complete."
delay 400
echo "---------------------------------------------------------------------"

# --- Test: Hyper-specific sudo permissions ---
login root mcgoopis

# Grant 'limitedsudo' the ability to run the 'cat' command, and nothing else.
echo 'limitedsudo cat' >> /etc/sudoers
useradd limitedsudo
testpass
testpass

chmod 701 /home/diagUser

# Create the specific file this user is meant to read.
echo "TOP SECRET" > /home/diagUser/diag_workspace/specific_file.txt

login limitedsudo testpass
cd /home/diagUser/diag_workspace

# This should SUCCEED because the user can run 'cat'
echo "Attempting to run allowed command ('cat') on a file..."
sudo cat /home/diagUser/diag_workspace/specific_file.txt
testpass

# This should FAIL because the user is not allowed to run 'ls'
echo "Attempting to run disallowed command ('ls')... (This should fail)"
check_fail "sudo ls /"

# Cleanup
login root mcgoopis
removeuser -f limitedsudo
# Clean up the sudoers file properly
grep -v "limitedsudo" /etc/sudoers > sudoers.tmp
mv sudoers.tmp /etc/sudoers
rm /home/diagUser/diag_workspace/specific_file.txt
login diagUser testpass

echo "Specific sudo tests complete."
delay 400
login root mcgoopis
removeuser -r -f limitedsudo
# Clean up the sudoers file properly
grep -v "limitedsudo" /etc/sudoers > sudoers.tmp; mv sudoers.tmp /etc/sudoers
delay 400

echo "--- Test: File ownership vs. permissions paradox ---"
useradd paradoxuser
testpass
testpass
touch paradox.txt
chown paradoxuser paradox.txt
# Now, paradoxuser owns the file but has no permissions to read it.
chmod 000 paradox.txt
login paradoxuser testpass
cd /home/diagUser/diag_workspace
# This MUST fail. Ownership doesn't override permissions.
check_fail "cat paradox.txt"
echo "Permission paradox test complete."
delay 400
login root mcgoopis
removeuser -r -f paradoxuser
rm paradox.txt
login diagUser testpass
cd /home/diagUser/diag_workspace
delay 700
echo "---------------------------------------------------------------------"

# --- Phase Z: Process & State Integrity Under Stress ---
echo ""
echo "===== Phase Z: Testing Process & State Integrity Under Stress ====="
delay 400

echo "--- Test: Background process race condition ---"
# This is a simple race condition test. The final content is non-deterministic,
# but the key is that the OS doesn't crash.
echo "one" > race.txt &
echo "two" > race.txt &
echo "three" > race.txt &
delay 500 # Give background jobs a moment to (hopefully) complete
echo "Race condition test initiated. Final content of race.txt:"
cat race.txt
rm race.txt
echo "Race condition test complete."
delay 400

echo "--- Test: State save/load integrity ---"
echo "pre-save" > state_integrity.txt
savestate
rm state_integrity.txt
mkdir -p new_dir_post_save
echo "post-save" > new_dir_post_save/another.txt
loadstate
YES
# After loading, the original file should exist and the new directory should NOT.
ls state_integrity.txt
check_fail "ls new_dir_post_save"
rm state_integrity.txt
echo "State integrity tests complete."
delay 700
echo "---------------------------------------------------------------------"

echo ""
echo "===== Phase Alpha: Core Command & Flag Behavior ====="
delay 400

echo "--- Test: diff Command ---"
echo -e "line one\nline two\nline three" > diff_a.txt
echo -e "line one\nline 2\nline three" > diff_b.txt
diff diff_a.txt diff_b.txt
rm diff_a.txt diff_b.txt
echo "diff test complete."
delay 400

echo "--- Test: cp -p (Preserve Permissions) ---"
touch preserve_perms.txt
chmod 700 preserve_perms.txt
cp -p preserve_perms.txt preserve_copy.sh
echo "Verifying preserved permissions:"
ls -l preserve_perms.txt preserve_copy.sh
rm preserve_perms.txt preserve_copy.sh
echo "cp -p test complete."
delay 400

echo "--- Test: touch with Time-Stamping ---"
touch -d "1 day ago" old_file.txt
touch -t 202305201200.30 specific_time.txt
echo "Verifying timestamps:"
ls -l old_file.txt specific_time.txt
rm old_file.txt specific_time.txt
echo "touch timestamp test complete."
delay 700
echo "---------------------------------------------------------------------"

echo ""
echo "===== Phase Beta: Group Permissions & Sudo ====="
delay 400

login root mcgoopis
echo "--- Test: Group Permissions ---"
groupadd testgroup
useradd testuser
testpass
testpass
usermod -aG testgroup testuser
touch group_test_file.txt
chown diagUser group_test_file.txt
chgrp testgroup group_test_file.txt
chmod 664 group_test_file.txt
login testuser testpass
cd /home/diagUser/diag_workspace
echo "Appending to file as group member (should succeed)..."
echo "appended" >> group_test_file.txt
cat group_test_file.txt
login Guest
cd /home/diagUser/diag_workspace
echo "Appending to file as Guest (should fail)..."
check_fail "echo 'appended by guest' >> group_test_file.txt"
login root mcgoopis
removeuser -f testuser
groupdel testgroup
rm group_test_file.txt
echo "Group permissions test complete."
delay 400

echo "--- Test: sudo with Granular Permissions ---"
useradd sudouser2
testpass
testpass
echo "sudouser2 ALL=(ALL) /bin/ls" >> /etc/sudoers
login sudouser2 testpass
echo "Running allowed sudo command (sudo ls)..."
sudo ls /home/root
testpass
echo "Running disallowed sudo command (sudo rm)..."
check_fail "sudo rm -f /some/file"
login root mcgoopis
removeuser -f sudouser2
grep -v "sudouser2" /etc/sudoers > sudoers.tmp && mv sudoers.tmp /etc/sudoers
echo "Granular sudo test complete."
delay 700
echo "---------------------------------------------------------------------"

echo ""
echo "===== Phase Delta: Advanced Data & Process Management ====="
delay 400
login diagUser testpass
cd /home/diagUser/diag_workspace

echo "--- Test: sort Flags ---"
echo -e "10\n2\napple\nbanana\napple" > sort_test.txt
echo "Numeric sort:"
sort -n sort_test.txt
echo "Reverse sort:"
sort -r sort_test.txt
echo "Unique sort:"
sort -u sort_test.txt
rm sort_test.txt
echo "sort test complete."
delay 400

echo "--- Test: find with -exec and -delete ---"
mkdir find_exec_test
touch find_exec_test/test.exec
touch find_exec_test/test.noexec
echo "Changing permissions with find -exec..."
find ./find_exec_test -name "*.exec" -exec chmod 777 {} \;
ls -l find_exec_test
echo "Deleting with find -delete..."
find ./find_exec_test -name "*.noexec" -delete
ls -l find_exec_test
rm -r find_exec_test
echo "find actions test complete."
delay 400

echo "--- Test: Pagers (more, less) Non-Interactive ---"
echo -e "line 1\nline 2\nline 3" > pager_test.txt
echo "Piping to 'more'..."
cat pager_test.txt | more | wc -l
echo "Piping to 'less'..."
cat pager_test.txt | less | wc -l
rm pager_test.txt
echo "Pager test complete."
delay 400

echo "--- Test: Input Redirection (<) ---"
echo "Redirected input" > input_redir.txt
cat < input_redir.txt
rm input_redir.txt
echo "Input redirection test complete."
delay 700
echo "---------------------------------------------------------------------"


echo ""
echo "===== Phase Theta: Filesystem Integrity & Edge Cases ====="
delay 400

echo "--- Test: rmdir on Non-Empty Directory ---"
mkdir non_empty_dir
touch non_empty_dir/file.txt
check_fail "rmdir non_empty_dir"
rm -r non_empty_dir
echo "rmdir on non-empty test complete."
delay 400

echo "--- Test: File I/O with Special Characters ---"
mkdir "a directory with spaces and.. special'chars!"
touch "a directory with spaces and.. special'chars!/-leading_dash.txt"
echo "Special content" > "a directory with spaces and.. special'chars!/-leading_dash.txt"
cat "a directory with spaces and.. special'chars!/-leading_dash.txt"
rm -r "a directory with spaces and.. special'chars!"
echo "Special characters test complete."
delay 400

echo "--- Test: xargs with Quoted Arguments ---"
touch "a file with spaces.tmp"
ls *.tmp | xargs -I {} mv {} {}.bak
ls *.bak
delay 500
rm *.bak
echo "xargs with quotes test complete."
delay 700
echo "---------------------------------------------------------------------"

# --- Phase Omega: Final Cleanup ---
echo ""
echo "--- Phase Omega: Final Cleanup ---"
cd /
login root mcgoopis
delay 300
removeuser -f diagUser
removeuser -f sudouser
removeuser -f testuser
removeuser -f testuser2
rm -r -f /home/diagUser
rm -r -f /home/sudouser
rm -r -f /home/testuser
rm -r -f /home/testuser2
login Guest
listusers
delay 700
echo "---------------------------------------------------------------------"
echo ""
echo "      ===== OopisOS Core Test Suite v4.2 Complete ======="
echo " "
delay 500
echo "  ======================================================"
delay 150
echo "  ==                                                  =="
delay 150
echo "  ==           OopisOS Core Diagnostics               =="
delay 150
echo "  ==            ALL SYSTEMS OPERATIONAL               =="
delay 200
echo "  ==                                                  =="
delay 150
echo "  ======================================================"
echo " "
delay 500
echo "(As usual, you've been a real pantload!)"
delay 200