# OopisOS v3.5 Tutorials

Welcome, Architect. This guide is your first step into the larger world of OopisOS. While the Command Reference is your dictionary, these tutorials are your Rosetta Stone, teaching you not just what commands do, but how to combine them into powerful, meaningful workflows.

Our goal is to transition control of the system to you, providing the tools and knowledge needed to explore with confidence and security. Let's begin.

### Your First Shell Script

**Objective:** To create and run a simple, executable script that can accept arguments from the command line.

This tutorial will teach you how to use the `edit` program, change file permissions with `chmod`, and execute your new script with `run`.

Step 1: Create the Script File

First, let's create a file for our script using the text editor.

Bash

```
edit welcome.sh
```

Step 2: Write the Script's Logic

The edit application will open. Type the following line into the editor:

Bash

```
echo "Welcome to OopisOS, $1!"
```

The `$1` is a special variable that represents the _first argument_ you pass to the script. After typing the line, save and exit the editor by pressing `Ctrl+S`.

Step 3: Make the Script Executable

By default, new files are not executable. Use chmod to add execute permissions. A mode of 700 is perfect for a personal script, as it gives you full control.

Bash

```
chmod 700 welcome.sh
```

Run `ls -l welcome.sh` to see the permissions change from `-rw-r--r--` to `-rwx------`.

Step 4: Run the Script

Finally, execute your script using the run command, and give it an argument to see the $1 variable in action.

Bash

```
run ./welcome.sh "Developer"
```

The system will output: `Welcome to OopisOS, Developer!` You have successfully created and run your first shell script.

---

### Setting Up a Shared Project

**Objective:** To demonstrate the full security model by creating a new group, adding users to it, and creating a shared directory that only group members can access.

Step 1: Assume Administrative Role with sudo

To manage users and groups, you need administrative privileges. Use the sudo command to run these commands. You will be prompted for the root user's password (mcgoopis).

Bash

```
sudo useradd devone
# (set password for devone)
sudo useradd devtwo
# (set password for devtwo)
sudo groupadd project_phoenix
```

Step 2: Add Users to the Group

Now, add both new users to the project_phoenix group.

Bash

```
sudo usermod -aG project_phoenix devone
sudo usermod -aG project_phoenix devtwo
```

Step 3: Create and Secure the Project Directory

Log in as one of the developers to create the shared directory.

Bash

```
login devone
# (enter devone's password)
mkdir /home/project_phoenix
```

By default, this directory is owned by `devone`. We need to change its group and permissions. Since `devone` owns the directory, they don't need `sudo` for these commands. The mode `770` (`rwxrwx---`) gives the owner (`devone`) and the group (`project_phoenix`) full access, while denying access to anyone else.

Bash

```
chgrp project_phoenix /home/project_phoenix
chmod 770 /home/project_phoenix
```

Step 4: Test the Permissions

As devone, you can create a file. Now, log out and log in as devtwo, who should also be able to create a file, proving the group permissions work.

Bash

```
touch /home/project_phoenix/devone_file.txt
logout
login devtwo
# (enter devtwo's password)
touch /home/project_phoenix/devtwo_file.txt
```

You have successfully created a secure, collaborative workspace.

---

### Ensuring Data Integrity: The Security Chain

**Objective:** To learn how to verify, transform, and protect your data using OopisOS's data integrity tools.

This tutorial demonstrates a workflow using `cksum`, `ocrypt`, and `base64` to create a verifiable "chain of custody" for your information.

Step 1: Create a Secret Message

First, create a file containing a secret message.

Bash

```
echo "The obstacle is the way." > my_secret.txt
```

Step 2: Get the Original Fingerprint

Use the cksum command to generate a checksum. This is the unique "fingerprint" of your original, unaltered file. Note this number down.

Bash

```
cksum my_secret.txt
```

Step 3: Obscure and Encode the Data

Now, let's obscure the file's content using ocrypt and encode it for safe transport using base64. This is done in a single, powerful pipeline.

Bash

```
cat my_secret.txt | ocrypt "taco-tuesday" | base64 > safe_to_send.txt
```

Your original file is untouched, but `safe_to_send.txt` now contains a seemingly random string of characters, safe to send over any text-based medium.

Step 4: Decode and Restore the Data

To get the original message back, you simply reverse the process.

Bash

```
cat safe_to_send.txt | base64 -d | ocrypt "taco-tuesday" > restored_secret.txt
```

Step 5: Verify the Integrity

The final, crucial step. Run cksum on the restored file.

Bash

```
cksum restored_secret.txt
```

The checksum number should be **identical** to the one you noted in Step 2. This proves, with mathematical certainty, that your data has survived the transformation process perfectly intact. You have mastered the chain of data integrity.

---

### Visualizing Your World: The File Explorer

**Objective:** To learn how to navigate the file system using the graphical file explorer.

Step 1: Launch the Explorer

The explore command opens the graphical user interface. You can launch it without arguments to start in your current directory, or give it a path.

Bash

```
explore /
```

Step 2: Navigate and View

The left pane shows an expandable directory tree. The right pane shows the contents of the selected directory. Double-click a folder in the right pane to navigate into it.

Step 3: Exit

Press the Esc key or click the '×' button in the top-right corner to close the explorer.

---

### Cloning Your Universe: Backup and Restore

**Objective:** To create a complete, verifiable backup of your OS, simulate a disaster, and restore your system from the backup file.

Step 1: Make a Change & Create Backup

First, create a marker file. Then, run the backup command. Your browser will prompt you to download a .json file containing your entire OS state.

Bash

```
echo "This is a test of the backup system." > /home/Guest/marker.txt
backup
```

Step 2: Simulate a System Reset

The reset command will completely wipe OopisOS. This is the ultimate test.

Bash

```
reset
# Type 'YES' and press Enter to confirm.
```

Step 3: Restore Your Universe

Run the restore command. Your browser will open a file dialog. Select the .json backup file you just downloaded. The system will verify the checksum, restore all your data, and then automatically reboot.

Bash

```
restore
```

Step 4: Verify the Restoration

Once OopisOS reloads, your marker.txt file will be back. You have successfully cloned and restored your digital universe.

Bash

```
ls /home/Guest/marker.txt
```