const pulumi = require("@pulumi/pulumi");
const azure = require("@pulumi/azure-native");

// Configuration variables
const resourceGroupName = "clco_project1";
const location = "westus";
const appServicePlanSku = {name: "B1", tier: "Basic", size: "B1", capacity: 3}; // Basic Tier mandatory with 3 instances
const pythonVersion = "PYTHON|3.8";
const SC_BRANCH ="main";
const SC_URL = "https://github.com/dmelichar/clco-demo.git";
const budgetScope = "/subscriptions/baf14dc0-aa90-480a-a428-038a6943c5b3"; // Subscription ID of Holzer's Azure Account



// Resource Group erstellen
const resourceGroup = new azure.resources.ResourceGroup(resourceGroupName, {
    location: location,
});

// Virtuelles Netzwerk erstellen
const vnet = new azure.network.VirtualNetwork("vnet", {
    resourceGroupName: resourceGroup.name,
    location: resourceGroup.location,
    addressSpace: {addressPrefixes: ["10.0.0.0/16"]},
    subnets: [
        {name: "privateEndPoint", addressPrefix: "10.0.1.0/24"},
        {name: "webappSubnet", addressPrefix: "10.0.2.0/24"},
    ],
});

// Private DNS Zone
const privateDnsZone = new azure.network.PrivateZone("privateDnsZone", {
    resourceGroupName: resourceGroup.name,
    location: resourceGroup.location,
    privateZoneName: "privatelink.cognitiveservices.azure.com",
});

// Virtual Network Link to DNS Zone
const vnetLink = new azure.network.VirtualNetworkLink("vnet-link", {
    resourceGroupName: resourceGroup.name,
    privateZoneName: privateDnsZone.name,
    virtualNetwork: {id: vnet.id},
    registrationEnabled: true,
});

// Cognitive Services Account
const cognitiveAccount = new azure.cognitiveservices.Account("cognitiveAccount", {
    resourceGroupName: resourceGroup.name,
    location: resourceGroup.location,
    kind: "TextAnalytics",
    sku: {name: "S"},
    properties: {
        name: "privateEndPoint",
        privateEndpoint: { subnet: { id: vnet.subnets[0].id } },
        privateLinkServiceConnectionState: {
            status: "Approved",
            description: "Auto-Approved",
        },
    },
});

// App Service Plan
const appServicePlan = new azure.web.AppServicePlan("appServicePlan", {
    resourceGroupName: resourceGroup.name,
    location: resourceGroup.location,
    sku: appServicePlanSku,
});

// Cognitive Account Keys
const accountKeys = azure.cognitiveservices.listAccountKeys({
    resourceGroupName: resourceGroup.name,
    accountName: cognitiveAccount.name,
})

// Web App
const webApp = new azure.web.WebApp("WebApp", {
    resourceGroupName: resourceGroup.name,
    location: resourceGroup.location,
    serverFarmId: appServicePlan.id,
    kind: "app",
    httpsOnly: true,
    siteConfig: {
        linuxFxVersion: pythonVersion,
        vnetRouteAllEnabled: true,
        scmType: "LocalGit",
        virtualNetworkSubnetId: vnet.subnets[1].id,
        virtualApplications: [{
            virtualPath: "/",
            physicalPath: "site\\wwwroot",
            preloadEnabled: true,
        }],
    },
});

// Configure App Settings with Cognitive Services Endpoint and Key
const appSettings = new azure.web.WebAppApplicationSettings("AppSettings", {
    resourceGroupName: resourceGroup.name,
    name: webApp.name,
    properties: {
        "COGNITIVE_ENDPOINT": cognitiveAccount.endpoint,
        "COGNITIVE_KEY": cognitiveAccount.primaryKey,
    },
});

// add Source Control
const sourceControl = new azure.web.WebAppSourceControl("SourceControl", {
    name: webApp.name,
    resourceGroupName: resourceGroup.name,
    branch: SC_BRANCH,
    repoUrl: SC_URL,
    isManualIntegration: true,
    isGitHubAction: false,
});

// Define a cost-efficient budget
const budget = new azure.consumption.Budget("workshopBudget", {
    scope: budgetScope,
    resourceGroupName: resourceGroup.name,
    amount: 5, // Example budget in USD
    timeGrain: "Monthly",
    timePeriod: {
        startDate: "2024-12-01",
        endDate: "2024-12-31",
    },
    category: "Cost",
    notifications: {
        Actual_GreaterThan_80_Percent: {
            contactEmails: [
                "wi22b090@technikum-wien.at",
                "wi22b004@technikum-wien.at",
            ],
            enabled: true,
            locale: azure.consumption.CultureCode.En_us,
            operator: azure.consumption.OperatorType.GreaterThan,
            threshold: 80,
            thresholdType: azure.consumption.ThresholdType.Actual,
        },
        Forecast_GreaterThan_80_Percent: {
            contactEmails: [
                "wi22b090@technikum-wien.at",
                "wi22b004@technikum-wien.at",
            ],
            enabled: true,
            operator: azure.consumption.OperatorType.GreaterThan,
            threshold: 80,
            thresholdType: azure.consumption.ThresholdType.Forecasted,
        },
    },
});

// Export Outputs
exports.resourceGroupName = resourceGroup.name;
exports.virtualNetworkName = vnet.name;
exports.privateDnsZoneName = privateDnsZone.name;
exports.cognitiveAccountName = cognitiveAccount.name;
exports.webAppName = webApp.name;
exports.endpoint = webApp.defaultHostName;
