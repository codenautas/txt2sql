import { OutWritter, OutWritterFactory, Txt2Sql } from '../src/txt2sql'

import * as assert from 'assert/strict'

const EOT = 'END OF TASK';

class ArrayWritter implements OutWritter{
    constructor(public array:(string|typeof EOT)[]){}
    async write(paragraph:string){
        this.array.push(paragraph)
    }
    async close(){
        this.array.push(EOT);
    }
}
class ArrayFactory implements OutWritterFactory{
    public arrays:Record<string, (string|typeof EOT)[]> = {}
    async open(fileName:string){
        this.arrays[fileName] = []
        return new ArrayWritter(this.arrays[fileName]);
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    async end(){}
}


describe("main txt2sql", function(){
    it("process simple table", async function(){
        const arrayFactory = new ArrayFactory();
        const inputLines = [
            "column1|column 2",
            "data11|data12",
            "data21|O'Donnell",
        ];
        const txt2sql = new Txt2Sql(arrayFactory);
        await txt2sql.processStart();
        for(const line of inputLines){
            // eslint-disable-next-line no-await-in-loop
            await txt2sql.processLine(line)
        }
        await txt2sql.processEnd();
        assert.deepEqual(
            arrayFactory.arrays,
            {
                create_table: [
                    "create table table1 (\n column1 text,\n column_2 text\n);",
                    EOT
                ],
                inserts: [
                    "insert into table1 (column1, column_2) values ('data11', 'data12');",
                    "insert into table1 (column1, column_2) values ('data21', 'O''Donnell');",
                    EOT
                ]
            }
        );
    });
})