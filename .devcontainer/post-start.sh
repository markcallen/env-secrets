#!/bin/bash
# Check if AWS CLI is already installed
if command -v aws &> /dev/null; then
    echo "AWS CLI is already installed:"
else
    # Install AWS CLI v2
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    unzip -q awscliv2.zip
    sudo ./aws/install
    rm -rf aws awscliv2.zip
    echo "AWS CLI installed successfully:"
fi
aws --version

# Set LocalStack version
LOCALSTACK_VERSION="4.7.0"

# Detect architecture
ARCH=$(uname -m)
if [ "$ARCH" = "x86_64" ]; then
    ARCH_NAME="amd64"
elif [ "$ARCH" = "aarch64" ]; then
    ARCH_NAME="arm64"
else
    echo "Unsupported architecture: $ARCH"
    exit 1
fi

# Check if LocalStack CLI is already installed
if command -v localstack &> /dev/null; then
    echo "LocalStack CLI is already installed:" 
else
    echo "LocalStack CLI not found, proceeding with installation..."
    # Download LocalStack CLI
    curl --output "localstack-cli-${LOCALSTACK_VERSION}-linux-${ARCH_NAME}-onefile.tar.gz" \
        --location "https://github.com/localstack/localstack-cli/releases/download/v${LOCALSTACK_VERSION}/localstack-cli-${LOCALSTACK_VERSION}-linux-${ARCH_NAME}-onefile.tar.gz"

    # Extract and install LocalStack
    tar xzf "localstack-cli-${LOCALSTACK_VERSION}-linux-${ARCH_NAME}-onefile.tar.gz"
    sudo mv localstack /usr/local/bin/
    rm "localstack-cli-${LOCALSTACK_VERSION}-linux-${ARCH_NAME}-onefile.tar.gz"
    echo "LocalStack CLI installed successfully:"
fi
localstack --version