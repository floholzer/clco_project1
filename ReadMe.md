# PAAS Project

## Overview
This project demonstrates the deployment of a Platform as a Service (PaaS) solution using Pulumi and Azure. It includes the creation of various Azure resources such as a resource group, virtual network, subnets, DNS zone, cognitive services account, private endpoint, app service plan, and a web app.

## Prerequisites
- Node.js and npm installed
- Pulumi CLI installed
- Azure CLI installed
- An Azure account

## Project Structure
- `index.js`: Contains the Pulumi JavaScript code for resource provisioning.
- `Pulumi.yaml`: Configuration file for the Pulumi project.

## Resources Created
- Resource Group
- Virtual Network
- Subnets
- Private DNS Zone
- Cognitive Services Account
- Private Endpoint
- App Service Plan
- Web App
- Source Control Integration
- Budget

## Configuration
Ensure you have the following configuration variables set in your environment or `Pulumi.yaml`:
- `azure-native:location`: The Azure region to deploy resources.
- `my:repoUrl`: The URL of the GitHub repository.
- `my:branch`: The branch of the GitHub repository.

## Deployment
1. Clone the repository:
    ```sh
    git https://github.com/floholzer/clco_project1
    cd clco_project1
    ```

2. Install dependencies:
    ```sh
    npm install
    ```

3. Login to Azure:
    ```sh
    az login
    ```

4. Initialize Pulumi:
    ```sh
    pulumi login
    pulumi stack init dev
    ```

5. Deploy the stack:
    ```sh
    pulumi up
    ```

## Outputs
After deployment, Pulumi will output the following:
- Resource Group Name
- Virtual Network Name
- Private DNS Zone Name
- Cognitive Account Name
- Web App Name
- Web App URL

## Cleanup
To remove all resources created by this project:
```sh
pulumi destroy