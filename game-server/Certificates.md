### Adding a certificate to your system/browser

#### Trust the root CA on ubuntu:

```bash
sudo cp dev-root-ca.crt /usr/local/share/ca-certificates/dev-root-ca.crt
sudo update-ca-certificates
```

To remove it:

```bash
sudo rm /usr/local/share/ca-certificates/dev-root-ca.crt
sudo update-ca-certificates --fresh
```

#### Adding the cert to brave

```bash
certutil -d sql:$HOME/.pki/nssdb -A -t "TC,C,C" -n "Dev Root CA" -i /usr/local/share/ca-certificates/dev-root-ca.crt
```

To remove it:

```bash
certutil -d sql:$HOME/.pki/nssdb -D -n "Dev Root CA"
```

Make sure the cert is trusted in brave at this page: _brave://settings/certificates_ <br>
Make sure also that the experimental WebTransport/QUIC-related related flag is enabled: _brave://flags_

### Info on the certs

A certificate contains identity information for a website, such as the domain name or IP address, plus the server’s public key, issuer information, validity dates, and other extensions.
For a client to establish encrypted TLS communication with a server, it needs to verify that the server really owns the public key associated with that domain, so it can avoid man-in-the-middle attacks.
To do that, the server sends its certificate, which is signed by a CA. The client checks the certificate’s signature using the public key of the issuing CA certificate.
That CA certificate is either already trusted by the client or chains up to another trusted CA certificate.
In practice, the client trusts a set of root CA certificates already installed in the browser or operating system, and it uses those as trust anchors.

There are many CAs, and certificates often form a chain: a server certificate is signed by an intermediate CA, which is signed by another CA above it, and so on until the chain reaches a root CA that the client already trusts.
That is where the term certificate chain comes from.

This all works because public-key cryptography lets the client verify signatures and establish trust without sharing secret keys in the open.
The private key stays on the server or CA side, while the public key can be shared.

For development purposes, we usually create our own local root CA, self-sign it, then use its private key to sign the development server certificate.
After that, we install the root CA certificate into our system or browser trust store.

So the simplified dev setup is:

dev-root-ca cert -> dev-server cert

### Creating Dev Certs (with openssl)

A certificate is obtained when a Certificate Authority (CA) issues a certificate for an entity after receiving and validating a request for it. The public key is inside the certificate itself.

For a local development setup, we usually do this:

1. Generate a local root CA private key.

```bash
openssl genrsa -out dev-root-ca.key 2048
```

2. Generate a self-signed root CA certificate from that private key.

```bash
openssl req -x509 -new -nodes \
  -key dev-root-ca.key \
  -sha256 -days 3650 \
  -out dev-root-ca.crt \
  -subj "/CN=Dev Root CA"
```

3. Generate a server private key.

```bash
openssl genrsa -out dev-server.key 2048
```

4. Generate a CSR for the server, which contains the server’s public key and identity information such as the hostname/IP.

Create this file: _dev-server.cnf_

```text
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = localhost

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
IP.1 = 127.0.0.1
IP.2 = ::1
```

Then create the CSR:

```bash
openssl req -new \
  -key dev-server.key \
  -out dev-server.csr \
  -config dev-server.cnf
```

5. Send the CSR to the local CA (The local CA signs the server CSR and produces the server certificate).

```bash
openssl x509 -req \
  -in dev-server.csr \
  -CA dev-root-ca.crt \
  -CAkey dev-root-ca.key \
  -CAcreateserial \
  -out dev-server.crt \
  -days 825 \
  -sha256 \
  -extfile dev-server.cnf \
  -extensions v3_req
```

(6. Install the root CA certificate into the system/browser trust store.)
