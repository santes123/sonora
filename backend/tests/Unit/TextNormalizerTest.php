<?php

namespace Tests\Unit;

use App\Support\TextNormalizer;
use PHPUnit\Framework\TestCase;

class TextNormalizerTest extends TestCase
{
    public function test_it_removes_accents_and_punctuation(): void
    {
        $this->assertSame('cancion del sur', TextNormalizer::normalize('  Canción   del SÜR!! '));
        $this->assertSame('ac dc', TextNormalizer::normalize('AC/DC'));
    }

    public function test_it_builds_a_safe_boolean_query(): void
    {
        $this->assertSame('+corazon*', TextNormalizer::toBooleanQuery('Corazón'));
        $this->assertSame('+the* +beatles*', TextNormalizer::toBooleanQuery('The Beatles +*()'));
    }

    public function test_short_terms_do_not_use_fulltext(): void
    {
        $this->assertNull(TextNormalizer::toBooleanQuery('ab'));
        $this->assertNull(TextNormalizer::toBooleanQuery('   '));
    }
}
