FROM amd64/node:13-slim
# Use Node v13 because sass do not support v14 for the moment
# docker build -t gskinner/regexr .
# docker run -p 3000:3000 gskinner/regexr
RUN npm install --global gulp-cli
RUN adduser runner && mkdir /regexr && chown runner:runner /regexr
USER runner
COPY . /regexr/
RUN cd /regexr && npm install
EXPOSE 3000
EXPOSE 3001
WORKDIR /regexr
CMD ["gulp"]