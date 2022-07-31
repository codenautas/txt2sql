# txt2sql
txt-to-sql 2.0


![designing](https://img.shields.io/badge/stability-designing-red.svg)


language: ![English](https://raw.githubusercontent.com/codenautas/multilang/master/img/lang-en.png)
also available in:
[![Spanish](https://raw.githubusercontent.com/codenautas/multilang/master/img/lang-es.png)](LEEME.md)

# Goal

Have an example of a objected oriented tool for migrate to RUST.

# Txt2Sql tool

Txt2SQl is a library that can be used in a command line tool or a web page to
*process a text file and convert it into SQL sentences*.

The tool will allow process of huge files that don't fit in memory reading the file only once.

In the future it can be add some new features (i.e. trying to detect de PK,
but for this may be it will need a second read of the file).


## Usage (command-line)



```sh
$ txt2sql file.txt
# Generates file-inserts.sql and file-create-table.sql
```


## Usage (code)


```js

```

## License

[MIT](LICENSE)

