App = {
    web3Provider: null,
    contracts: {},
    account: "0x0",
    hasVoted: false,

    // Start the app
    init: async function () {
        return await App.initWeb3();
    },

    // Connect to MetaMask (or fallback to Ganache HTTP)
    initWeb3: async function () {
        // 1) New MetaMask - window.ethereum
        if (window.ethereum) {
            App.web3Provider = window.ethereum;
            try {
                // Ask MetaMask to connect this site
                await window.ethereum.request({ method: "eth_requestAccounts" });
                console.log("MetaMask connected");
            } catch (error) {
                console.error("User denied MetaMask connection", error);
                alert("You must connect MetaMask to use this app.");
                return;
            }
            web3 = new Web3(App.web3Provider);
        }
        // 2) Old dapp browsers
        else if (typeof window.web3 !== "undefined") {
            App.web3Provider = window.web3.currentProvider;
            web3 = new Web3(App.web3Provider);
        }
        // 3) No MetaMask - direct HTTP provider
        else {
            App.web3Provider = new Web3.providers.HttpProvider("http://localhost:7545");
            web3 = new Web3(App.web3Provider);
            alert("MetaMask not found. Using local Ganache provider.");
        }

        return App.initContract();
    },

    // Load contract
    initContract: function () {
        $.getJSON("Election.json", function (election) {
            // Instantiate a new truffle contract from the artifact
            App.contracts.Election = TruffleContract(election);
            // Connect provider to interact with contract
            App.contracts.Election.setProvider(App.web3Provider);

            //App.listenForEvents();

            return App.render();
        });
    },

    // Listen for events emitted from the contract (optional)
    // listenForEvents: function () {
    //     App.contracts.Election.deployed().then(function (instance) {
    //         instance.votedEvent({}, {
    //             fromBlock: 0,
    //             toBlock: "latest"
    //         }).watch(function (error, event) {
    //             console.log("event triggered", event)
    //             App.render();
    //         });
    //     });
    // },

    // Draw UI
    render: function () {
        var electionInstance;
        var loader = $("#loader");
        var content = $("#content");

        loader.show();
        content.hide();

        // Load account data
        web3.eth.getCoinbase(function (err, account) {
            if (err === null && account) {
                App.account = account;
                $("#accountAddress").html(
                    "<span id='accountTag'>Your Account :</span> <span id='myAccount'>" +
                    account +
                    "</span>"
                );
            }
        });

        // Load contract data
        App.contracts.Election.deployed()
            .then(function (instance) {
                electionInstance = instance;
                return electionInstance.candidatesCount();
            })
            .then(function (candidatesCount) {
                var candidatesResults = $("#candidatesResults");
                candidatesResults.empty();

                var candidatesSelect = $("#candidatesSelect");
                candidatesSelect.empty();

                for (var i = 1; i <= candidatesCount; i++) {
                    electionInstance.candidates(i).then(function (candidate) {
                        var id = candidate[0];
                        var name = candidate[1];
                        var voteCount = candidate[2];

                        // Render candidate Result
                        var candidateTemplate =
                            "<tr><td>" +
                            id +
                            "</td><td>" +
                            name +
                            "</td><td>" +
                            voteCount +
                            "</td></tr>";
                        candidatesResults.append(candidateTemplate);

                        // Render candidate ballot option
                        var candidateOption =
                            "<option value='" + id + "'>" + name + "</option>";
                        candidatesSelect.append(candidateOption);
                    });
                }
                return electionInstance.voters(App.account);
            })
            .then(function (hasVoted) {
                // Do not allow a user to vote twice
                if (hasVoted) {
                    $("form").hide();
                    $("#voteStatus").show();
                }
                loader.hide();
                content.show();
            })
            .catch(function (error) {
                console.warn(error);
            });
    },

    // Vote function
    castVote: function () {
        var candidateId = $("#candidatesSelect").val();
        App.contracts.Election.deployed()
            .then(function (instance) {
                return instance.vote(candidateId, { from: App.account });
            })
            .then(function (result) {
                // Wait for votes to update
                $("#content").hide();
                $("#loader").show();
            })
            .catch(function (err) {
                console.error(err);
            });
    }
};

$(function () {
    $(window).load(function () {
        App.init();
    });
});
