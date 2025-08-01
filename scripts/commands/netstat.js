// scripts/commands/netstat.js

window.NetstatCommand = class NetstatCommand extends Command {
    constructor() {
        super({
            commandName: "netstat",
            description: "Shows network status and connections.",
            helpText: `Usage: netstat
      Displays a list of all discovered OopisOS instances and their connection status.

      DESCRIPTION
      The netstat command provides a summary of the current network
      status. It lists your own instance ID and shows all other OopisOS
      instances that have been discovered on the local network or through
      the signaling server. It will also indicate which of these peers have
      an active, direct WebRTC connection.

      EXAMPLES
      netstat
      Displays your instance ID and a list of other known instances.`
        });
    }

    async coreLogic(context) {
        const { dependencies } = context;
        const { NetworkManager, ErrorHandler } = dependencies;

        const output = [];
        output.push(`Your Instance ID: ${NetworkManager.getInstanceId()}`);
        output.push("\nDiscovered Remote Instances:");

        const remoteInstances = NetworkManager.getRemoteInstances();
        if (remoteInstances.length === 0) {
            output.push("  (None)");
        } else {
            remoteInstances.forEach(id => {
                const peer = NetworkManager.getPeers().get(id);
                const status = peer ? ` (Status: ${peer.connectionState})` : " (Status: Disconnected)";
                output.push(`  - ${id}${status}`);
            });
        }

        return ErrorHandler.createSuccess(output.join('\n'));
    }
};

window.CommandRegistry.register(new NetstatCommand());
