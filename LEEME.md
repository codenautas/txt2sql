<!--multilang v0 es:LEEME.md en:README.md -->
# txt2sql
<!--lang:es-->
txt-to-sql 2.0

<!--lang:en--]
txt-to-sql 2.0

[!--lang:*-->

<!-- cucardas -->
![designing](https://img.shields.io/badge/stability-designing-red.svg)

<!--multilang buttons-->

idioma: ![castellano](https://raw.githubusercontent.com/codenautas/multilang/master/img/lang-es.png)
también disponible en:
[![inglés](https://raw.githubusercontent.com/codenautas/multilang/master/img/lang-en.png)](README.md)

<!--lang:es-->
# Objetivo

Hacer un ejercicio de una herramienta orientada a objetos para luego migrarla a RUST. 

<!--lang:en--]
# Goal

Have an example of a objected oriented tool for migrate to RUST.

[!--lang:es-->
# Descripción de Txt2Sql

Txt2Sql es una librería que puede conectarse a la línea de comandos o a una página web
que sirve para *procesar un archivo de texto para convertirlo en sentencias SQL*. 
Genera las instrucciones SQL para crear la tabla y para insertar los registros. 
Además podría detectar los tipos de las columnas de la tabla a crear. 

La herramienta permitirá leer un archivo gigante (que no entre en memoria) en una sola pasada. 

En versiones posteriores se podría agregar:
   1. detectar el formato del archivo (CSV, TXT con otros separadores, delimitador de textos, registros multilíneas, nulos, etc)
   2. permitir dos pasadas para cierta funcionalidad (automáticamente o manualmente)
   3. detectar la PK 
   4. detectar columnas lógicas en diferentes convenciones o idiomas
   5. generar archivos adicionales con estadísticas o descripción del contenido del archivo de texto
   6. encolumnar el resultado
   7. utlizar formatos de bulk insert (por ejemplo [COPY FROM ... FORMAT TEXT de PostgreSQL](https://www.postgresql.org/docs/current/sql-copy.html))
   8. opciones para la normalización de nombres

<!--lang:en--]
# Txt2Sql tool

Txt2SQl is a library that can be used in a command line tool or a web page to
*process a text file and convert it into SQL sentences*.

The tool will allow process of huge files that don't fit in memory reading the file only once. 

In the future it can be add some new features (i.e. trying to detect de PK, 
but for this may be it will need a second read of the file).

[!--lang:es-->

## Uso (línea de comandos)

<!--lang:en--]

## Usage (command-line)

[!--lang:*-->

<!--lang:es-->

```sh
$ txt2sql file.txt
# Genera los archivos: file-inserts.sql and file-create-table.sql
```

<!--lang:en--]

```sh
$ txt2sql file.txt
# Generates file-inserts.sql and file-create-table.sql
```

[!--lang:es-->

## Uso (código)

<!--lang:en--]

## Usage (code)

[!--lang:*-->

```js

```

<!--lang:es-->
## Licencia
<!--lang:en--]
## License
[!--lang:*-->

[MIT](LICENSE)

