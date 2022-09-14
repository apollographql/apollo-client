FROM python:3.10

# install PDM
RUN pip install -U pip setuptools wheel
RUN pip install pdm

# copy files
COPY pyproject.toml pdm.lock /project/
COPY . /project

WORKDIR /project
RUN pdm install --prod --no-lock --no-editable

STOPSIGNAL SIGINT

CMD ["pdm", "run", "server"]
