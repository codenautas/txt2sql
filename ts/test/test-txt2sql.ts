import { ChunkReader, Txt2Sql, EOT } from '../src/txt2sql'

import * as assert from 'assert/strict'

var READ_CONTENT4DEBUG = Symbol("READ_CONTENT4DEBUG")

function createChunkReader():ChunkReader{
    var chunks:(string|typeof EOT )[] = [];
    return function chunkReader(chunk:string | typeof EOT | typeof READ_CONTENT4DEBUG){
        if(chunk === READ_CONTENT4DEBUG){
            return chunks;
        }
        chunks.push(chunk)
    }
}

describe("main txt2sql", function(){
    it("process simple table", async function(){
        var inserts = createChunkReader()
        var createTable = createChunkReader()
        var inputLines = [
            "column1|column 2",
            "data11|data12",
            "data21|O'Donnell",
        ];
        var txt2sql = new Txt2Sql({inserts, createTable});
        for(var line of inputLines){
            txt2sql.processLine(line)
        }
        txt2sql.processLine(EOT)
        console.log('aca 2');
        assert.deepEqual(
            createTable(READ_CONTENT4DEBUG),
            [
                "create table table1 (\n column1 text,\n column_2 text\n);",
                EOT
            ]
        );
        assert.deepEqual(
            inserts(READ_CONTENT4DEBUG),
            [
                "insert into table1 (column1, column_2) values ('data11', 'data12');",
                "insert into table1 (column1, column_2) values ('data21', 'O''Donnell');",
                EOT
            ]

        );
    });
})