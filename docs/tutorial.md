# OopisOS v3.1 Tutorials

Welcome to the OopisOS tutorials. While the Command Reference explains what each command does, this guide will show you how to combine them to accomplish larger tasks. These walkthroughs are designed to teach you the core workflows of the operating system.

### Your First Shell Script

**Objective:** To create and run a simple, executable script that can accept arguments from the command line.

This tutorial will teach you how to use the `edit` program, change file permissions with `chmod`, and execute your new script with `run`.

**Step 1: Create the Script File**
First, let's create a file for our script using the text editor.
```bash
edit welcome.sh
````

**Step 2: Write the Script's Logic**
The `edit` application will open. Type the following line into the editor:

```bash
echo "Welcome to OopisOS, $1!"
```

The `$1` is a special variable that represents the *first argument* you pass to the script. After typing the line, save and exit the editor by pressing `Ctrl+S`.

**Step 3: Make the Script Executable**
By default, new files are not executable. Use `chmod` to add execute permissions. A mode of `700` is perfect for a personal script, as it gives you full control.

```bash
chmod 700 welcome.sh
```

Run `ls -l welcome.sh` to see the permissions change from `-rw-r--r--` to `-rwx------`.

**Step 4: Run the Script**
Finally, execute your script using the `run` command, and give it an argument to see the `$1` variable in action.

```bash
run ./welcome.sh "Developer"
```

The system will output: `Welcome to OopisOS, Developer!` You have successfully created and run your first shell script.

-----

### Setting Up a Shared Project

**Objective:** To demonstrate the full security model by creating a new group, adding users to it, and creating a shared directory that only group members can access.

**Step 1: Assume Administrative Role with `sudo`**
To manage users and groups, you need administrative privileges. Use the `sudo` command to run these commands. You will be prompted for the `root` user's password (`mcgoopis`).

```bash
sudo useradd devone
# (set password for devone)
sudo useradd devtwo
# (set password for devtwo)
sudo groupadd project_phoenix
```

**Step 2: Add Users to the Group**
Now, add both new users to the `project_phoenix` group.

```bash
sudo usermod -aG project_phoenix devone
sudo usermod -aG project_phoenix devtwo
```

**Step 3: Create and Secure the Project Directory**
Log in as one of the developers to create the shared directory.

```bash
login devone
# (enter devone's password)
mkdir /home/project_phoenix
```

By default, this directory is owned by `devone`. We need to change its group and permissions. Since `devone` owns the directory, they don't need `sudo` for these commands.

```bash
chgrp project_phoenix /home/project_phoenix
chmod 770 /home/project_phoenix
```

The mode `770` (`rwxrwx---`) gives the owner (`devone`) and the group (`project_phoenix`) full access, while denying access to anyone else.

**Step 4: Test the Permissions**
As `devone`, you can create a file. Now, log out and log in as `devtwo`, who should also be able to create a file, proving the group permissions work.

```bash
touch /home/project_phoenix/devone_file.txt
logout
login devtwo
# (enter devtwo's password)
touch /home/project_phoenix/devtwo_file.txt
```

You have successfully created a secure, collaborative workspace.

-----

### Exploring Your System with AI

**Objective:** To showcase how the integrated AI tools (`chidi` and `gemini`) can be used to analyze and interact with your file system.

**Step 1: Populate Your Home Directory**
First, ensure you are logged in as `Guest` and run the `inflate.sh` script to create a variety of example files.

```bash
run /extras/inflate.sh
```

**Step 2: Analyze Documents with `chidi`**
Now that you have some Markdown files, use the AI Librarian to analyze them.

```bash
chidi /home/Guest/docs
```

This opens a new interface listing all `.md` files in that directory. You can click "Summarize" to get an AI-generated summary or "Ask" to query the entire set of documents.

**Step 3: Use `gemini` for System Queries**
The `gemini` command can use other OS tools to answer questions about the system.

```bash
gemini "list all the oopic files in the home directory"
```

The AI will understand the request, run `find /home -name "*.oopic"`, and present the results in a user-friendly format.

-----

### Visualizing Your World: The File Explorer

**Objective:** To learn how to navigate the file system using the graphical file explorer.

**Step 1: Launch the Explorer**
The `explore` command opens the graphical user interface. You can launch it without arguments to start in your current directory, or give it a path.

```bash
explore /
```

**Step 2: Navigate the Tree**
The left pane shows an expandable directory tree. Click on the folder icons or summaries to expand or collapse directories. The highlighted directory is the one currently being viewed in the right pane.

**Step 3: View Contents**
The right pane shows the contents of the selected directory, including file/folder icons, permissions, and sizes. You can double-click on a directory in this pane to navigate into it.

**Step 4: Exit**
Press the `Esc` key or click the '×' button in the top-right corner to close the explorer and return to the terminal.

-----

### Cloning Your Universe: Backup and Restore

**Objective:** To create a complete, verifiable backup of your OS, simulate a disaster, and restore your system from the backup file.

**Step 1: Make a Change**
First, create a new file so we have a clear marker to verify the restore was successful.

```bash
echo "This is a test of the backup system." > /home/Guest/marker.txt
```

**Step 2: Create a Secure Backup**
Run the `backup` command. This will package your entire OopisOS state—all users, files, and settings—into a single `.json` file that includes a security checksum. Your browser will prompt you to download and save this file to your actual computer.

```bash
backup
```

**Step 3: Simulate a System Reset**
Now for the scary part. The `reset` command will completely wipe OopisOS.

```bash
reset
# Type 'YES' and press Enter to confirm.
```

After the reset, the system will be blank, as if it were your first time visiting. The `marker.txt` file will be gone.

**Step 4: Restore Your Universe**
Run the `restore` command. Your browser will open a file dialog. Select the `.json` backup file you downloaded in Step 2.

```bash
restore
```

The system will verify the checksum, restore all your data, and then automatically reboot.

**Step 5: Verify the Restoration**
Once OopisOS reloads, check for your marker file.

```bash
ls /home/Guest/marker.txt
```

The file is back. You have successfully cloned and restored your digital universe.