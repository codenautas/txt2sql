import { OutWritter, OutWritterFactory, Txt2Sql } from '../src/txt2sql'

import {promises as fs} from 'fs';

import * as YAML from 'yaml';

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

class StringFactory extends ArrayFactory{
    override async end(){
        for(const name in this.arrays){
            const plain = this.arrays[name].filter(x => x != EOT).join('');
            // @ts-expect-error converting results to plain strig
            this.arrays[name] = plain
        }
    }
}


describe("txt2sql unit test", function(){
    it("process simple table", async function(){
        const arrayFactory = new ArrayFactory();
        const inputLines = [
            "column1|column 2",
            "data11|data12",
            "data21|O'Donnell",
        ];
        const txt2sql = new Txt2Sql(arrayFactory, {
            field_separator: '|',
            table_name: 'table1',
            insert_columns: true,
            multi_insert: false,
            quote_identifiers: '',
            case: 'lower',
            infer_types: false,
            output_types: false
        });
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
                    "create table table1 (\n column1 text,\n column_2 text\n);\n",
                    EOT
                ],
                inserts: [
                    "insert into table1 (column1, column_2) values ('data11', 'data12');\n",
                    "insert into table1 (column1, column_2) values ('data21', 'O''Donnell');\n",
                    EOT
                ]
            }
        );
    });
});

describe("txt2sql integratin tests", function(){
    const test = (path: string) => 
        it("test fixture "+path, async function(){
            const fixtureYaml = await fs.readFile(`../fixtures/${path}`, 'utf8');
            const fixture = YAML.parse(fixtureYaml);
            const stringFactory = new StringFactory();
            const txt2sql = new Txt2Sql(stringFactory, fixture.options);
            await txt2sql.processStart();
            for(const line of fixture.input.split(/\r?\n/)){
                // eslint-disable-next-line no-await-in-loop
                await txt2sql.processLine(line);
            }
            await txt2sql.processEnd();
            if(fixture.infered_info){
                assert.deepEqual(
                    txt2sql.inferedInfo(),
                    fixture.infered_info
                );
            }
            assert.deepEqual(
                stringFactory.arrays,
                fixture.outputs
            );
        });
    test('simple-data.yaml');
    test('infer-data-types.yaml');
})