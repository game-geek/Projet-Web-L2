## Mini docker image creation reminder + ghcr upload

- ### Step 1: create Dockerfile

Go see /Dockerfile for an example

make sure to add:

```bash
LABEL org.opencontainers.image.source=https://github.com/USERNAME/REPO_NAME 
```

<br>

- ### Step 2: create .dockerignore

Same use case as a .gitignore and usage.

<br>

- ### Step 3: build your docker image

```bash
docker build -t IMAGE_NAME PATH_TO_DOCKER_FILE_DIRECTORY 
```

*-t* stands for *tag*, aka a name for your image.

<br>

- ### Step 4[optional]: run your docker image to test it
```bash
docker run DOCKER_IMAGE_NAME
```
*DOCKER_IMAGE_NAME* being the tag you gave to the image when building it.

```bash
docker run DOCKER_IMAGE_NAME -p DOCKER_CONTAINER_INTERNAL_PORT:HOST_PORT
```

If you want a port to be accessible on the host, you have to setup port forwarding *-p* to expose that internal port to an external host port of your choice (exposing a remapped port)

Ctr^C ing a running container does not kill it.

```bash
docker ps
```
This displays all the running docker containers IDs.

```bash
docker stop DOCKER_CONTAINER_ID
```
This terminates a running docker container

<br>


- ### Step 5: login ghcr

First go in your github settings and create a classic personnal access token (PAT) with at least package.write and package.read permissions.

```bash
echo PAT | docker login ghcr.io -u GITHUB_ACCOUNT_USERNAME --password-stdin
```
This command allows you to login via a token and without your token appearing in the terminal theoretically. (for it to not appear in the logs)

<br>

- ### Step 6: tag your local image with the target registry path

```bash
docker tag YOUR_DOCKER_IMAGE_NAME ghcr.io/GITHUB_ACCOUNT_NAME/GITHUB_REPO/YOUR_DOCKER_IMAGE_NAME_OR_WHATEVER
```

The reason you have to add *ghcr.io/GITHUB_ACCOUNT_NAME/GITHUB_REPO/* in front of your docker image name is for docker pushes the name of the image, so it must include the registry path.

<br>

- ### Step 7: push the image to ghcr

```bash
docker push ghcr.io/GITHUB_ACCOUNT_NAME/GITHUB_REPO/YOUR_DOCKER_IMAGE_NAME_OR_WHATEVER
```
