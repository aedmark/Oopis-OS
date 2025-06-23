# OopisOS Tutorials

Welcome to the OopisOS tutorials. While the Command Reference explains what each command does, this guide will show you how to combine them to accomplish larger tasks. These walkthroughs are designed to teach you the core workflows of the operating system.

### Your First Shell Script

**Objective:** To create and run a simple, executable script that can accept arguments from the command line.

This tutorial will teach you how to use the `edit` program, change file permissions with `chmod`, and execute your new script with `run`.

**Step 1: Create the Script File** First, let's create a file for our script using the text editor.

Bash

```
edit welcome.sh
```

**Step 2: Write the Script's Logic** The `edit` application will open. Type the following line into the editor:

Bash

```
echo "Welcome to OopisOS, $1!"
```

The `$1` is a special variable that represents the _first argument_ you pass to the script. After typing the line, save and exit the editor by pressing `Ctrl+S`.

**Step 3: Check Permissions** Now that you're back at the command line, let's check the permissions of our new file.

Bash

```
ls -l welcome.sh
```

You will see something like `-rw-r--r--`, which means the file has read and write permissions, but not execute permissions. We need to change that.

**Step 4: Make the Script Executable** We'll use `chmod` to add execute permissions for the owner of the file. A mode of `700` (`rwx------`) is perfect for a personal script, as it gives you full control while denying access to everyone else.

Bash

```
chmod 700 welcome.sh
```

Run `ls -l welcome.sh` again, and you will now see permissions like `-rwx------`.

**Step 5: Run the Script** Finally, execute your script using the `run` command, and give it an argument to see the `$1` variable in action.

Bash

```
run ./welcome.sh "Developer"
```

The system will output: `Welcome to OopisOS, Developer!`

You have successfully created and run your first shell script.

---

### Setting Up a Shared Project

**Objective:** To demonstrate the full security model by creating a new group, adding multiple users to it, and creating a shared directory that only group members can access.

**Step 1: Assume Administrative Role** To manage users and groups, you must be `root`.

Bash

```
login root mcgoopis
```

**Step 2: Create Users and a Group** Let's create two new users and a group for them to collaborate in.

Bash

```
useradd devone
# (set password)
useradd devtwo
# (set password)
groupadd project_phoenix
```

**Step 3: Add Users to the Group** Now, add both new users to the `project_phoenix` group.

Bash

```
usermod -aG project_phoenix devone
usermod -aG project_phoenix devtwo
```

You can verify this with the `groups` command: `groups devone`.

**Step 4: Create and Secure the Project Directory** Log in as one of the developers to create the shared directory.

Bash

```
logout
login devone
# (enter password)

mkdir /home/project_phoenix
```

By default, this directory is owned by `devone` and its group is `devone`. We need to change the group and set the correct permissions.

**Step 5: Set Ownership and Permissions** First, change the directory's group to `project_phoenix`. Then, use `chmod` to set permissions so that only the owner and members of the group can read, write, and execute within it. The mode `770` (`rwxrwx---`) is perfect for this.

Bash

```
chgrp project_phoenix /home/project_phoenix
chmod 770 /home/project_phoenix
```

**Step 6: Test the Permissions** As `devone`, you can create a file in the directory.

Bash

```
touch /home/project_phoenix/devone_file.txt
```

Now, log out and log in as `devtwo`. You should also be able to create a file, proving the group permissions work.

Bash

```
logout
login devtwo
# (enter password)

touch /home/project_phoenix/devtwo_file.txt
```

You have successfully created a secure, collaborative workspace.

---

### Exploring Your System with AI

**Objective:** To showcase how the integrated AI tools (`chidi` and `gemini`) can be used to analyze and interact with your file system.

**Step 1: Populate Your Home Directory** First, ensure you are logged in as `Guest` and run the `inflate.sh` script to create a variety of example files.

Bash

```
run /inflate.sh
```

**Step 2: Analyze Documents with `chidi`** Now that you have some Markdown files, use the AI Librarian to analyze them.

Bash

```
chidi /home/Guest/docs
```

This opens a new interface listing all `.md` files in that directory. You can click on a file to read it, or you can use the AI functions. For instance, select `alpha_report.md` and click the "Summarize" button to get an AI-generated summary of its contents.

**Step 3: Ask `gemini` to Find and Read a File** The `gemini` command can use other OS tools to answer your questions.

Bash

```
gemini "What is the subject of the 'alpha_report.md' file?"
```

The AI will find the file, read its contents, and provide you with a direct answer based on the context it gathered.

**Step 4: Use `gemini` for Broader System Queries** `gemini` is also useful for general exploration.

Bash

```
gemini "list all the ASCII art files in the images directory"
```

The AI will understand the request, run `find . -name "*.oopic"` in the appropriate directory, and present the results in a user-friendly format.

This demonstrates how OopisOS's AI tools provide a powerful, natural-language interface for exploring and understanding your digital world.